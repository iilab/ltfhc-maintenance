#!/usr/bin/env node

/**
 * Maintenance App
 */

var blessed = require('blessed')
  , contrib = require('blessed-contrib')
  , util = require('util')
  , _ = require('highland')
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
  , running;

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


// Render the screen.
screen.render();

var run = function(action) {
  log.log('action: ' + action)
  switch(action) {
    case "ping":
        log.log("--- " + action + " running --- ");
        running = spawn('ping', ['-c 4', 'localhost']);
        break;
    case "diag":
        running = spawn('ls', ['-la']);
        break;
    default:
        return "{red-fg}failed{/red-fg}"
  }

  _(running.stdout).each(function(i){
      var str = i.toString()
      var arr = str.match(/^.*([\n\r]+|$)/gm);
      _(arr).each(function(i) {
        log.log(i);
      })
    });

  _(running.stderr).each(function(i){
      var str = i.toString()
      var arr = str.match(/^.*([\n\r]+|$)/gm);
      _(arr).each(function(i) {
        log.log("{red-fg}" + i + "{/red-fg}");
      })
    });

  running.on('close', function (code) {
    log.log("---  result: " + code);
  });
}

