#!/usr/bin/env node

/**
 * Maintenance App
 */

var blessed = require('blessed')
  , contrib = require('blessed-contrib')
  , util = require('util')
  , fs = require('fs')
  , __ = require('highland')
  , _ = require('underscore')
  , async = require('async')
  , screen = blessed.screen(
     {
       autoPadding: true,
       smartCSR: true
     })
  , sys = require('sys')
  , spawn = require('child_process').spawn
  , help
  , log
  , actions
  , running // the currently running spawned children_process
  , running_stdout;

var debug = process.env.DEBUG || false;

var server_ip = null,
    server_connection = null,
    server_hostname = null,
    server_dbs = null,
    patient_count = "",
    visit_count = "";

screen.title = 'LTFHC EMR - Maintenance';

// actions

var actions_data = { headers: [ "Action",        "Status"]
                   , data:  [ [ "Connect (WiFi)","Run to connect to the server." ]
                            , [ "Connect (LAN)", "Run to connect to the server." ]
                            , [ "Data Download", "Run to download data." ]
                            , [ "Upgrade",       "Run to upgrade the EMR software." ]
                            , [ "Diagnostics",   "Run to collect diagnostic information." ]
                            ]
                   }

var actions_state_init = { connect_wifi   : "enabled"    // Connect (WiFi)
                    , connect_lan    : "enabled"    // Connect (LAN)
                    , data_download  : "disabled"   // Data Download
                    , upgrade        : "disabled"   // Upgrade
                    , diagnostics    : "disabled" } // Diagnostics


screen.key('tab', function(ch, key) {
  screen.focusNext();
  screen.render();
})

// Quit on Escape, q if no action is running.
screen.key(['escape', 'q'], function(ch, key) {
  if ( _(actions_state).any(function(v) {return (v == "running")}) ) {
    screen.append(alert)
    alert.log("An action is running, please wait before you exit or use Ctrl-C to force.\n\r", 2);
    alert.focus();
    return;
  }
  return process.exit(0);
});

// Quit unconditionally with Control-C.
screen.key(['C-c'], function(ch, key) {
  return process.exit(0);
});

/**
 * Widget Grid
 */

if (debug) {
  var grid = new contrib.grid({rows: 4, cols: 2})
} else {
  var grid = new contrib.grid({rows: 4, cols: 1})  
}

// Actions Widget

// grid.set(row, col, rowSpan, colSpan, obj, opts)
grid.set(0, 0, 1, 3, contrib.table, {  keys: true
                                     , tags: true
                                     , fg: 'green'
                                     , columnSpacing: [18, 12] /*or just 16*/})

// Help Widget

grid.set(3, 0, 1, 1, blessed.box, {
  content: '{bold}Help{/bold}\nTo run a command, select it with the arrow keys and click enter.\n\nChoose a connection method:\n  - (WiFi is preferable) Connect to the health network.\n  - For LAN setup the laptop IP to 172.16.99.2 and connect to LAN2 on the server.\n\r Please make sure to run diganostics in order to collect important system information and identify potential problems. Hit q or the esc key to exit. Use Ctrl-C if the program is stuck.',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: '#f0f0f0'
    },
    hover: {
      bg: 'green'
    }
  }
})

// Log Widget

if (debug) {
  grid.set(0, 1, 1, 4, contrib.log, { fg: "green"
    , selectedFg: "green"
    , label: 'Server Log'
    , bufferLength: 120
    , tags: true})
}

function log_log(message) {
  log.log(message);
  fs.appendFile('/vagrant/maintenance.log', new Date().toISOString() + " - " + message && message.replace(/{\/?.*?}/g, '').toString("utf8") + "\n\r", function (err) {
      if (err) {
        screen.append(alert)
        alert.error("Unexpected error writing to the maintenance.log file", 0);
        alert.focus();
        screen.render();
      }
  });
  actions.setData( 
    { headers: actions.data.headers
    , data: actions.data.data.map(function(v,i){
        return (_(actions_state).values()[i] == "running")? [v[0], v[1] + "{green-fg}.{/green-fg}"] : v
      })
    }
  );
  screen.render();
}


// Apply grid layout

grid.applyLayout(screen)

if (debug) {
  log = grid.get(0,1)
} else {
  log = contrib.log({ fg: "green"
    , selectedFg: "green"
    , label: 'Server Log'
    , bufferLength: 120
    , tags: true})
}

help = grid.get(3,0)

actions = grid.get(0,0)

// table

actions.setData(actions_data);

function actions_state_render(state) {
  actions.setData( 
    { headers: actions.data.headers
    , data: actions.data.data.map(function(v,i){
        if (_(state).values()[i] == "disabled") {
          formatted_status = "{light-black-fg}" + v[1].replace(/{\/?.*?}/g, '') + "{/light-black-fg}"
        } else {
          formatted_status = "{green-fg}" + v[1].replace(/{\/?.*?}/g, '') + "{/green-fg}"
        }
        return [v[0], formatted_status]
      })
    }
  );
  screen.render();
}

function shallowCopy(oldObj) {
    var newObj = {};
    for(var i in oldObj) {
        if(oldObj.hasOwnProperty(i)) {
            newObj[i] = oldObj[i];
        }
    }
    return newObj;
}
actions_state = shallowCopy(actions_state_init);
actions_state_render(actions_state);

// Alert box (hidden at start)
var alert = blessed.message({
  top: 'center',
  left: 'center',
  width: '40%',
  height: 'shrink',
  tags: true,
  align: "center",
  padding : {
    top: 1,
    bottom:1
  },
  shrink : true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'white'
    },
    hover: {
      bg: 'green'
    }
  }
});

/**
 * Action Event
 */

actions.rows.key('enter', function(ch, key) {
  var sel = actions.rows.selected.toString();
  if ( _(actions_state).any(function(v) {return (v == "running")}) ) {
    screen.append(alert)
    alert.log("An action is running, please wait.\n\r", 2);
    alert.focus();
    return;
  }
  if (_(actions_state).values()[sel] == 'enabled') {
    var result = run(actions.data.data[sel][0]);
  } else {
    screen.append(alert)
    alert.log("This action is disabled.\n\r", 2);
    alert.focus();
  }
  screen.render();
})

//actions.focus();

// Render the screen.
screen.render();

// Should try to log to disk now before continuing.

try {

  var run = function(action) {

    var maintenance_env = process.env;

    maintenance_env.ANSIBLE_HOST_KEY_CHECKING = "False"
    maintenance_env.ANSIBLE_SSH_HOST = "192.168.42.1"

    var spawn_opts ={ 
      cwd: "/home/vagrant",
      env: maintenance_env//,
      //detached: true
    }

    switch(action) {
      case "Connect (WiFi)":
          action_start(action);
          actions_state.connect_wifi = "running";
          actions_state.connect_lan = "disabled";
          actions_state_render(actions_state);
          async.auto({
              local_ping: [local_ping],
              local_ansible: ['local_ping', local_ansible],
              server_ping_wifi: ['local_ansible', server_ping_wifi],
              server_ansible_wifi: ['server_ping_wifi', server_ansible_wifi],
              server_get_name_wifi: ['server_ansible_wifi', server_get_name_wifi]
          }, function (err, results) {
              if (err) {
                _(results).every(function(val, key) {
                  switch(key) {
                    case "local_ping":
                      message = (val != 0)?"{red-fg}Local network stack problem. Check that the network is enabled.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "local_ansible":
                      message = (val != 0)?"{red-fg}Maintenance software problem. Check that you use the latest ltfhc-maintenance.box.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "server_ping_wifi":
                      message = (val != 0)?"{red-fg}Cannot contact the server. Check that you are connected to the 'health' wifi network.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "server_ansible_wifi":
                      message = (val != 0)?"{red-fg}Cannot log into the server. Check that the hosts file is present.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "server_get_name_wifi":
                      message = (val != 0)?"{red-fg}Cannot get the server name. Please try again.{/red-fg}":""
                      return (val == 0);
                      break;                      
                  }
                })
                action_error(action, message);
                actions_state.connect_wifi = "enabled";
                actions_state.connect_lan = "enabled";
                actions_state_render(actions_state);
              } else {
                // Callback with the results.
                server_ip = results.server_ping_wifi
                server_connection = "wifi"
                server_hostname = results.server_get_name_wifi
                actions_state.connect_wifi = "disabled";
                actions_state.connect_lan = "disabled";
                actions_state.data_download = "enabled";
                actions_state.upgrade = "enabled";
                actions_state.diagnostics = "enabled";
                actions_state_render(actions_state);
                action_success(action, "Connected - " + server_hostname + " / IP: " + server_ip );   
              }
          });
          break;
      case "Connect (LAN)":
          action_start(action);
          actions_state.connect_lan = "running";
          actions_state.connect_wifi = "disabled";
          actions_state_render(actions_state);
          async.auto({
              local_ping: [local_ping],
              local_ansible: ['local_ping', local_ansible],
              server_ping_lan: ['local_ansible', server_ping_lan],
              server_ansible_lan: ['server_ping_lan', server_ansible_lan],
              server_get_name_lan: ['server_ansible_lan', server_get_name_lan]
          }, function (err, results) {
              if (err) {
                _(results).every(function(val, key) {
                  switch(key) {
                    case "local_ping":
                      message = (val != 0)?"{red-fg}Local network stack problem. Check that the network is enabled.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "local_ansible":
                      message = (val != 0)?"{red-fg}Maintenance software problem. Check that you use the latest ltfhc-maintenance.box.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "server_ping_lan":
                      message = (val != 0)?"{red-fg}Cannot contact the server. Check that you are connected to server's LAN port.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "server_ansible_lan":
                      message = (val != 0)?"{red-fg}Cannot log into the server. Check that the hosts file is present.{/red-fg}":""
                      return (val == 0);
                      break;
                    case "server_get_name_lan":
                      message = (val != 0)?"{red-fg}Cannot get the server name. Please try again.{/red-fg}":""
                      return (val == 0);
                      break;                      
                  }
                })
                action_error(action, message);
                actions_state.connect_lan = "enabled";
                actions_state.connect_wifi = "enabled";
                actions_state_render(actions_state);
              } else {
                // Callback with the results.
                server_ip = results.server_ping_lan
                server_connection = "lan"
                server_hostname = results.server_get_name_lan
                actions_state.connect_wifi = "disabled";
                actions_state.connect_lan = "disabled";
                actions_state.data_download = "enabled";
                actions_state.upgrade = "enabled";
                actions_state.diagnostics = "enabled";
                actions_state_render(actions_state);
                action_success(action, "Connected - " + server_hostname + " / IP: " + server_ip );   
              }
          });
          break;      
      case "Data Download":
          action_start(action);
          actions_state.data_download = "running";
          actions_state_render(actions_state);
          async.auto({
              test_emr: [test_emr],
              data_download: ['test_emr', data_download],
              data_patient_count: ['data_download', data_patient_count],
              data_visit_count: ['data_patient_count', data_visit_count]
          }, function (err, results) {
              if (err) {
                switch(err) {
                  case "test_emr":
                    message = "{red-fg}Cannot connect to the EMR.{/red-fg}"
                    break;
                  case "data_download":
                    message = "{red-fg}Cannot download data.{/red-fg}"
                    break;
                  case "data_patient_count":
                    message = "{red-fg}Cannot inspect data, are you sure this is a DRC deployment?{/red-fg}"
                    break;
                  case "data_visit_count":
                    message = "{red-fg}Cannot inspect data, are you sure this is a DRC deployment?{/red-fg}"
                    break;
                }
                action_error(action, message);
                actions_state.data_download = "enabled";
                actions_state_render(actions_state);
              } else {
                // Callback with the results.
                actions_state.data_download = "enabled";
                actions_state_render(actions_state);
                patient_count = (results.data_patient_count !=0) ? results.data_patient_count : "{red-fg}" + results.data_patient_count + "{/red-fg}";
                visit_count = (results.data_visit_count !=0) ? results.data_visit_count : "{red-fg}" + results.data_visit_count + "{/red-fg}";
                action_success(action, "Data downloaded - " + results.data_download + ".json file created. Patient count: " + patient_count + " / Visit count: " + visit_count);   
              }
          });
          break;
      case "Upgrade":
          action_start(action);
          actions_state.upgrade = "running";
          actions_state_render(actions_state);
          async.auto({
              test_kansorc: [test_kansorc],
              test_emr_login: ['test_kansorc', test_emr_login],
              prepare_kanso_config: ['test_emr_login', prepare_kanso_config],
              test_emr_version: ['prepare_kanso_config', test_emr_version],
              upgrade: ['test_emr_version', upgrade],
              test_emr_upgrade: ['upgrade', test_emr_upgrade]
          }, function (err, results) {
              if (err) {
                switch(err) {
                  case "test_kansorc":
                    message = "{red-fg}Cannot find kansorc file.{/red-fg}"
                    break;
                  case "test_emr_login":
                    message = "{red-fg}Cannot connect via kanso and create test database.{/red-fg}"
                    break;
                  case "prepare_kanso_config":
                    message = "{red-fg}Problem while configuring the upgrade.{/red-fg}"
                    break;
                  case "test_emr_version":
                    message = "{red-fg}This script hasn't been tested for upgrading other EMR versions than 0.4.2.{/red-fg}"
                    break;
                  case "upgrade":
                    message = "{red-fg}CRITICAL ERROR: Problem during the EMR upgrade.{/red-fg}"
                    break;
                  case "test_emr_upgrade":
                    message = "{red-fg}CRITICAL ERROR: The EMR didn't update properly.{/red-fg}"
                    break;                
                }
                action_error(action, message);
                actions_state.upgrade = "enabled";
                actions_state_render(actions_state);
              } else {
                // Callback with the results.
                actions_state.upgrade = "enabled";
                actions_state_render(actions_state);
                action_success(action, "EMR Upgraded");   
              }
          });
          break;          
      case "Diagnostics":
          action_start(action);
          actions_state.diagnostics = "running";
          actions_state_render(actions_state);
          async.auto({
              diagnostics: [diagnostics],
              reports: ['diagnostics', reports]
          }, function (err, results) {
              if (err) {
                _(results).every(function(val, key) {
                  switch(key) {
                    case "diagnostics":
                      message = (val != 0)?"{red-fg}Cannot run diagnostics. Check that...{/red-fg}":""
                      return (val == 0);
                      break;
                  }
                })
                action_error(action, message);
                actions_state.diagnostics = "enabled";
                actions_state_render(actions_state);
              } else {
                // Callback with the results.
                actions_state.diagnostics = "enabled";
                actions_state_render(actions_state);
                action_success(action, "Data downloaded - " + results.data_download + ".json file created");   
              }
          });
          break;          
      default:
          return "{red-fg}failed{/red-fg}"
    }

    /*
    / Actions
    /***/

    // Connectivity

    function local_ping(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect", "local_ping", 'ping -i 0.5 -c 4 localhost', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }

    function local_ansible(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect", "local_ansible",  'ansible all -i "127.0.0.1," -m ping --connection local', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }

    function server_ping_wifi(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect (WiFi)", "server_ping", 'ping -i 0.5 -c 4 192.168.42.1', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, "192.168.42.1")
        }
      });
    }

    function server_ansible_wifi(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect (WiFi)", "server_ansible", 'ansible -i /vagrant/hosts_wifi.sh test_wifi -m ping', callback );
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }

    function server_ping_lan(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect (WiFi)", "server_ping", 'ping -i 0.5 -c 4 172.16.99.1', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, "172.16.99.1")
        }
      });
    }

    function server_ansible_lan(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect (WiFi)", "server_ansible", 'ansible -i /vagrant/hosts_lan.sh test_lan -m ping', callback );
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }

 
    function server_get_name_wifi(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect (WiFi)", "server_get_name", "ansible -i /vagrant/hosts_wifi.sh test_wifi -m setup -o -a 'filter=ansible_hostname' | awk -F'>>' '{print $2}' | jq -r '. | .ansible_facts.ansible_hostname'", callback );
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, running_stdout.replace('\n',''))
        }
      });
    }

    function server_get_name_lan(callback, results) {
      var proc = null;
      proc = spawn_sh("Connect", "server_get_name", "ansible -i /vagrant/hosts_lan.sh test_lan -m setup -o -a 'filter=ansible_hostname' | awk -F'>>' '{print $2}' | jq -r '. | .ansible_facts.ansible_hostname'", callback );
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, running_stdout.replace('\n',''))
        }
      });
    }


    // Data Download

    function test_emr(callback, results) {
      var proc = null;
      proc = spawn_sh("Data Download", "test_emr", "kanso listdb https://" + server_ip, callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          if (running_stdout.indexOf('emr_' + server_hostname) > -1) {
            log_log("--- command success  --- (emr_" + server_hostname + " db found)");
            callback(null, true)
          } else {
            log_log("{red-fg}--- command error --- (emr_" + server_hostname + " db not found){/red-fg}"); 
            callback("test_emr", code)
          }
        }
      });
    }

    function data_download(callback, results) {
      var proc = null;
      var data_filename = server_hostname + "-" + new Date().toISOString().
                      replace(/[-:]/g, '').      // remove - and :
                      replace(/T/, '_').      // replace T with an underscore
                      replace(/\..+/, '')     // delete the dot and everything after;
      proc = spawn_sh("Data Download", "data_download", 'curl -k -o /vagrant/' + data_filename + '.json -X GET https://' + server_ip + '/emr_' + server_hostname + '/_all_docs\?include_docs\=true', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("data_download", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, data_filename)
        }
      });
    }

    function data_patient_count(callback, results) {
      var proc = null;
      var data_filename = results.data_download;
      proc = spawn_sh("Data Download", "data_patient_count", 'cat /vagrant/' + data_filename + ".json | jq '[.rows[].doc.collection] | map(select(. == \"patients\")) | length'", callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("data_patient_count", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, running_stdout)
        }
      });
    }

    function data_visit_count(callback, results) {
      var proc = null;
      var data_filename = results.data_download;
      proc = spawn_sh("Data Download", "data_visit_count", 'cat /vagrant/' + data_filename + ".json | jq '[.rows[].doc.collection] | map(select(. == \"visits\")) | length'", callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("data_visit_count", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, running_stdout)
        }
      });
    }



    // Upgrade

    // relink kanso.json

    function test_kansorc(callback, results) {
      var proc = null;
      proc = spawn_sh("Upgrade", "test_kansorc", "cat /vagrant/ltfhc-next/.kansorc > /dev/null", callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("test_kansorc", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, true)
        }
      });
    }

    function test_emr_login(callback, results) {
      var proc = null;
      proc = spawn_sh("Upgrade", "test_emr_login", "cd /vagrant/ltfhc-next/; kanso createdb test_" + server_connection + " ; kanso deletedb test_" + server_connection, callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("test_emr_login", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, true)
        }
      });
    }

    function prepare_kanso_config(callback, results) {
      var proc = null;
      proc = spawn_sh("Upgrade", "prepare_kanso_config", "cp /vagrant/kanso.json." + server_hostname + " /vagrant/ltfhc-next/kanso.json", callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("prepare_kanso_config", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, true)
        }
      });
    }

    function test_emr_version(callback, results) {
      var proc = null;
      proc = spawn_sh("Upgrade", "test_emr_version", 'curl -k --connect-timeout 10 -sS https://demo:demo@' + server_ip + '/emr_' + server_hostname + '/_design/emr/modules.js | grep -e \'\"name\":\"emr\",\"version\":\"0.4.2\"\'', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("test_emr_version", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, true)
        }
      });
    }

    function upgrade(callback, results) {
      var proc = null;
      proc = spawn_sh("Upgrade", "upgrade", "cd /vagrant/ltfhc-next/; kanso push " + server_hostname + "_" + server_connection, callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("upgrade", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, true)
        }
      });
    }

    function test_emr_upgrade(callback, results) {
      var proc = null;
      proc = spawn_sh("Upgrade", "test_emr_upgrade", 'curl -k --connect-timeout 10 -sS https://demo:demo@' + server_ip + '/emr_' + server_hostname + '/_design/emr/modules.js | grep -e \'\"name\":\"emr\",\"version\":\"0.5.0\"\'', callback);
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("test_emr_upgrade", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, true)
        }
      });
    }

    // Diagnostics

    function diagnostics(callback, results) {
      var proc = null;
      proc = spawn_sh("Diagnostics", "diagnostics", 'cd /vagrant/ltfhc-config; ansible-playbook -i /vagrant/hosts_' + server_connection + '.sh playbook/site.yml -t diagnose -l ' + server_hostname, callback );
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("diagnostics", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }

    function reports(callback, results) {
      var proc = null;
      proc = spawn_sh("Diagnostics", "reports", 'tar cvzf /vagrant/lthfc-config/reports/' + server_connection + ' ' + server_hostname + '.tgz', callback );
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "){/red-fg}"); 
          callback("diagnostics", code)
        } else {
          log_log("--- command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }



    // Check time 

    // Get users

    // Utility functions

    function spawn_sh(action, cmd_name, command, cb) {
      var p = null;
      log_log('--- command: ' + command + ' ---');
      p = spawn('bash',['-c', command], spawn_opts);
/*      p.on('exit', function(code, signal) {
        if (code != 0) {
          log_log("{red-fg}--- command error --- (" + code + "," + signal + "){/red-fg}"); 
          cb(code, code)
          return null;
        }
      });*/
      hook_std(action, cmd_name, p);
      return p;
    }

    function action_start(action) {
      log_log("")
      log_log("=== action " + action  + " running ===")
      log_log("")
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, "Running "] : v
          })
        }
      );
    }

    function action_success(action, message) {
      //var message = util.inspect(results, false, null).toString()
      log_log("=== action " + action + " success === " + join_lines(message))
      log_log("")
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, join_lines(message)] : v
          })
        });
      screen.render();
    }

    function action_error(action, message) {
      //var message = util.inspect(results, false, null).toString()
      log_log("{red-fg}=== action " + action + " error === " + join_lines(message) + "{/red-fg}")
      log_log("")
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, "{red-fg}ERROR!!!{/red-fg} " + join_lines(message)] : v
          })
        }
      );
      screen.render();
    }

    function join_lines(str) {
      var arr = str.match(/[^\r\n]+/gm);
        if (arr) {
          return arr.join(" ");
        } else {
          return str
        }
    }

    function hook_std(action, cmd, proc) {
      running_stdout = "";
      __(proc.stdout).each(function(i){
        var str = i.toString()
        running_stdout += str;
        var arr = str.match(/[^\r\n]+/gm);
        if (arr) {
          __(arr).each(function(i) {
            log_log("{light-black-fg}" + action + " - " + cmd + " - " + i.replace(/\x1B\[([0-9](;[0-9])?)?[mGK]/g, '') + "{/light-black-fg}");
          })
        } else {
          log_log("{light-black-fg}" + action + " - " + cmd + " - " + str.replace(/\x1B\[([0-9](;[0-9])?)?[mGK]/g, '') + "{/light-black-fg}")
        }
      });

      __(proc.stderr).each(function(i){
        var str = i.toString()
        var arr = str.match(/[^\r\n]+/gm);
        if (arr) {
          __(arr).each(function(i) {
            log_log("{red-fg}" + action + " - " + cmd + " - " + "{red-fg}" + i + "{/red-fg}");
          })
        } else {
          log_log("{red-fg}" + action + " - " + cmd + " - " + str + "{/red-fg}")
        }
      });
    }
  }
}
catch(err) {
  screen.append(alert)
  alert.error(err.message, 0);
  screen.render();
}

process.on('uncaughtException', function (err) {
   // handle or ignore error
  screen.append(alert)
  alert.error("Unexpected error. {bold}Please send maintenance.log file to iilab.{/bold}\n\r\n\r" + err.stack, 0);
  log.log("Unexpected error. " + err.stack);
  alert.focus();
  screen.render();
  fs.appendFile('/vagrant/maintenance.log', new Date().toISOString() + " -- " + err.stack.toString("utf8") + "\n\r", function (err) {
      if (err) {
        screen.append(alert)
        alert.error("Unexpected error writing to the maintenance.log file", 0);
        screen.render();
      }
  });
  actions_state_render(actions_state_init);
});