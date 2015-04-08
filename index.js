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

screen.title = 'LTFHC EMR - Maintenance';

// actions

var actions_config = [ { label: "Connectivity"
                       , state: "Please run."
                       , cmd: "ping"
                       }
                     , { label: "Diagnostic" 
                       , state: "Please run."
                       , cmd: "diag"} 
                     ]


/**
 * Action Event
 */

screen.key('enter', function(ch, key) {
  //var val = "Selected " + util.inspect(actions.rows, {showHidden: false, depth: 2});
  //arr = val.match(/^.*([\n\r]+|$)/gm);
  var sel = actions.rows.selected.toString();
  var result = run(actions_config[sel].cmd);
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

var grid = new contrib.grid({rows: 4, cols: 2})

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

grid.set(0, 1, 1, 4, contrib.log, { fg: "green"
  , selectedFg: "green"
  , label: 'Server Log'
  , bufferLength: 120
  , tags: true})

// Apply grid layout

grid.applyLayout(screen)

log = grid.get(0,1)

help = grid.get(3,0)

actions = grid.get(0,0)

// table

actions.setData( { headers: ['Action', 'Result']
               , data: actions_config.map(function(n){
                    return [n.label, n.state]
                 })
               });

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
    bg: 'red',
    border: {
      fg: '#f0f0f0'
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
    log.log('action: ' + action)

    function ping_localhost(callback, results) {
          running = spawn('ping', ['-c 4', 'localhost']);
          running.on('close', function (code) {
            callback(null, code)
            log.log("---  result: " + code);
          });
    }

    function net_get_local_ip(callback, results) {
          running = spawn('ping', ['-c 4', 'localhost']);
          running.on('close', function (code) {
            callback(null, code)
            log.log("---  result: " + code);
          });
    }

    function ansible_ping(callback, results) {
  //        running = spawn('ping', ['-c 4', 'localhost']);
          running = spawn('ansible',['all','-i','"192.168.168.2,"','-m ping'])
          running.on('close', function (code) {
            callback(null, code)
            log.log("---  result: " + code);
          });
    }

    switch(action) {
      case "ping":
          log.log("--- " + action + " running --- ");
          async.auto({
              net_ping_self: [net_ping_self],
              net_ping: ['net_ping_self', net_ping],
              ansible_ping: ['net_ping', ansible_ping]
          }, function (err, results) {
              if (err) {
                  return "{red-fg}" + err + "{/red-fg}"
              }
              // Callback with the row.
              success("ping", results.ip);
          });
          break;
      case "diag":
          running = spawn('/vagrant/ltfhc-config/run.sh', []);
          break;
      default:
          return "{red-fg}failed{/red-fg}"
    }

    _(running.stdout).each(function(i){
        var str = i.toString()
//        log.log(str)
        var arr = str.match(/.+([\n\r]$)/gm);
        _(arr).each(function(i) {
          log.log(i);
        })
      });

    _(running.stderr).each(function(i){
        var str = i.toString()
        var arr = str.match(/.+([\n\r]$)/gm);
        _(arr).each(function(i) {
          log.log("{red-fg}" + i + "{/red-fg}");
        })
      });

  }

  function success(cmd, result) {
    try {
      actions.setData( { headers: ['Action', 'Result']
                   , data: actions_config.map(function(n){
                        return (n.cmd == cmd)? [n.label, result] : [n.label, n.state]
                     })
                   });
    }
    catch(err) {
      screen.append(alert)
      alert.display(err.stack, 0);
      screen.render();
      //TODO: Log error to file.
    }
    screen.render();
  }

}
catch(err) {
  // Create a box perfectly centered horizontally and vertically.

  // Append our box to the screen.
  alert.error(err.message, 0);

  //screen.render();

}