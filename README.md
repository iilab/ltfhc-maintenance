# ltfhc-maintenance

Maintenance application for LTFHC - EMR which provides a simple interface to:
 - Run diagnostics
 - Download data
 - Upgrade sotfware and configuration

This application is meant to be ran inside a Vagrant virtual machine on a Windows 7 or 8 computer. The install.bat script in ```ltfhc-maintenance-install``` should have been ran. It installs VirtualBox and Vagrant and Downloads the maintenance virtual machine.

The install script should install a shortcut to start the app. Otherwise it can be started from the command line, from inside the ```ltfhc-maintenance-install``` folder by entering ```vagrant ssh ''```

## Instructions

### Connectivity

 - The connectivity scripts do the following checks

** Need to test how slow/fast a wifi based download/upgrade is **

     + Basics
         * Check that the network is available (ping localhost)
         * Check that ansible is installed
         * Check that the local wifi interface is available
     + Try via the wifi port. Check if a wifi connection is on. 
         * If yes, check if the laptop is connected to the 'health' SSID.
             - If yes, try to ping the server. (192.168.42.1)
             - If not, then try to connect to 'health' SSID
                 + If yes, then try to ping the server. (192.168.42.1)
                     * If yes, go to diagnostics
         * If not, then continue
     + Try via the ethernet port. Check if an ethernet connection is on.
         * for each of the following IP pairs (172.16.99.2/172.16.99.1, 172.16.99.1/172.16.99.2)
         * If yes, check if the ip address of the interface is ()

### Diagnostic


### Upgrade 

 - 

### Data Download


### District Data Upload and Upgrade



### Options

 - Install: Download ltfhc-maintenance-install.bat file and double click.
     *  Install vagrant, virtualbox
     *  Download vagrant box (which includes ansible, ltfhc-maintenance and ltfhc-config)
 - Run: Double click icon on Desktop.
 - Operate: Use arrows and enter key.
 - Report: Drag and drop log file in email.

## Troubleshooting

If there's a problem with connecting:
  - Check the properties of the interface. On W7, open Network Center, click on the interface to get a status overview, then on the Properties button. You will get a list of services, protocols and adapters. That list should contain the VirtualBox Bridged Adapter service.
  - 

## Development

While in the ltfhc-maintenance folder run 
```node index.js```
