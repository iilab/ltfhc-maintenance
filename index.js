#!/usr/bin/env node

/**
 * Maintenance App
 */

var blessed = require('blessed')
  , contrib = require('blessed-contrib')
  , util = require('util')
  , _ = require('highland')
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
  , running; // the currently running spawned children_process

var debug = false;

screen.title = 'LTFHC EMR - Maintenance';

// actions

var actions_data = { headers: [ "Action",        "Status"]
                   , data:  [ [ "Connectivity",  "Run to connect to the server." ]
                            , [ "Data Download", "Run to download data." ]
                            , [ "Upgrade",       "Run to upgrade the EMR software." ]
                            , [ "Diagnostics",   "Run to test the EMR software." ]
                            ]
                   }

/**
 * Action Event
 */

screen.key('enter', function(ch, key) {
  var sel = actions.rows.selected.toString();
  var result = run(actions.data.data[sel][0]);
  screen.render();
})

screen.key('tab', function(ch, key) {
  log.focus;
  if (table.focus) { log.focus } else { table.focus }
  screen.render();
})

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
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
grid.set(0, 0, 1, 3, contrib.table, { keys: true
 , fg: 'green'
 , label: 'Actions'
 , columnSpacing: [16, 12, 12] /*or just 16*/})

// Help Widget

grid.set(3, 0, 1, 1, blessed.box, {
  content: '{bold}Help{/bold}\nTo run a command, select it with the arrow keys and click enter.',
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

// Alert box (hidden at start)
var alert = blessed.message({
  top: 'center',
  left: 'center',
  width: '40%',
  height: '40%',
  label: 'Error',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'red'
    },
    hover: {
      bg: 'green'
    }
  }
});


// Render the screen.
screen.render();

// Should try to log to disk now before continuing.

try {

  var run = function(action) {
    switch(action) {
      case "Connectivity":
          action_start(action);
          async.auto({
              local_ping: [local_ping],
              local_ansible: ['local_ping', local_ansible],
              server_ping: ['local_ansible', server_ping],
              server_ansible: ['server_ping', server_ansible]
          }, function (err, results) {
              if (err) {
                action_error(action, results);
              } else {
                // Callback with the results.
                action_success(action, results);
              }
          });
          break;
      case "diag":
          running = spawn('/vagrant/ltfhc-config/run.sh', []);
          break;
      default:
          return "{red-fg}failed{/red-fg}"
    }

    /*
    / Actions
    /***/

    // Connectivity

    function local_ping(callback, results) {
      proc = spawn_sh("Connectivity", 'ping -i 0.5 -c 4 localhost');
      proc.on('close', function(code) {
        if (code != 0) {
          log_log("ping", "{red-fg}---  command error --- (" + code + "){/red-fg}"); 
          callback(code, code)
        } else {
          log_log("ping", "---  command success  --- (" + code + ")");
          callback(null, code)
        }
      });
    }

    function local_ansible(callback, results) {
      proc = spawn_sh("Connectivity", 'ansible all -i "127.0.0.1," -m ping --connection local');
      proc.on('close', function(code) {
        if (code != 0) {
          callback(code, code)
          log_log("ping", "{red-fg}---  command error --- (" + code + "){/red-fg}"); 
        } else {
          callback(null, code)
          log_log("ping", "---  command success  --- (" + code + ")");
        }
      });
    }

    function server_ping(callback, results) {
      proc = spawn_sh("Connectivity", 'ping -i 0.5 -c 4 192.168.42.1');
      proc.on('close', function(code) {
        if (code != 0) {
          callback(code, code)
          log_log("ping", "{red-fg}---  command error --- (" + code + "){/red-fg}"); 
        } else {
          callback(null, code)
          log_log("ping", "---  command success  --- (" + code + ")");
        }
      });
    }

    function server_ansible(callback, results) {
      proc = spawn_sh("Connectivity", 'ansible all -i "192.168.42.1," -m ping');
      proc.on('close', function(code) {
        if (code != 0) {
          callback(code, code)
          log_log("ping", "{red-fg}---  command error --- (" + code + "){/red-fg}"); 
        } else {
          callback(null, code)
          log_log("ping", "---  command success  --- (" + code + ")");
        }
      });
    }

    function server_get_name(callback, results) {
      proc = spawn_sh("Connectivity", 'ansible all -i "192.168.42.1," -m ping');
      proc.on('close', function(code) {
        if (code != 0) {
          callback(code, code)
          log_log("ping", "{red-fg}---  command error --- (" + code + "){/red-fg}"); 
        } else {
          callback(null, code)
          log_log("ping", "---  command success  --- (" + code + ")");
        }
      });
    }

    // Data Download

    function data_download(callback, results) {
      proc = spawn_sh("Data Download", 'curl -X GET https://www.health/emr/_all_docs\?include_docs\=true');
      proc.on('close', function(code) {
        if (code != 0) {
          callback(code, code)
          log_log("ping", "{red-fg}---  command error --- (" + code + "){/red-fg}"); 
        } else {
          callback(null, code)
          log_log("ping", "---  command success  --- (" + code + ")");
        }
      });
    }


    // Upgrade

    // Diagnostics

    // Utility functions

    var spawn_opts ={ 
      cwd: "/home/vagrant",
      env: process.env
    }

    function spawn_sh(action, command) {
      log_log(action, 'command: ' + command);
      p = spawn('bash',['-c', command]);
      hook_std(action, p);
      return p;
    }

    function action_start(action) {
      log_log(action, "---  action " + action  + " running --- ")
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, "Running "] : v
          })
        }
      );
    }

    function action_success(action, results) {
      message = util.inspect(results, false, null).toString()
      log_log(action, "--- action " + action + " success --- " + join_lines(message))
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, join_lines(message)] : v
          })
        });
      screen.render();
    }

    function action_error(action, results) {
      var message = util.inspect(results, false, null).toString()
      log.log(action, "{red-fg}--- action " + action + " error --- " + join_lines(message) + "{/red-fg}")
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, join_lines(message)] : v
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


    function hook_std(action, process) {
      _(process.stdout).each(function(i){
        var str = i.toString()
        var arr = str.match(/[^\r\n]+/gm);
        if (arr) {
          _(arr).each(function(i) {
            log_log(action, i);
          })
        } else {
          log_log(action, str)
        }
      });

      _(process.stderr).each(action, function(i){
        var str = i.toString()
        var arr = str.match(/[^\r\n]+/gm);
        if (arr) {
          _(arr).each(function(i) {
            log_log(action, "{red-fg}" + i + "{/red-fg}");
          })
        } else {
          log_log(action, str)
        }
      });
    }

    function log_log(action, message) {
      log.log(message);
      // TODO: log to disk
      actions.setData( 
        { headers: actions.data.headers
        , data: actions.data.data.map(function(v,i){
            return (actions.data.data[i][0] == action)? [action, actions.data.data[i][1] + "."] : v
          })
        }
      );
      screen.render();
    }
  }
}
catch(err) {
  screen.append(alert)
  alert.error(err.message, 0);
  screen.render();
}