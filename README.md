# ltfhc-maintenance

Maintenance application for LTFHC - EMR which provides a simple interface to:
 - Run diagnostics
 - Download data
 - Upgrade sotfware and configuration

This application is meant to be ran inside a Vagrant virtual machine on a Windows 7 or 8 computer. The install.bat script in ```ltfhc-maintenance-install``` should have been ran. It installs VirtualBox and Vagrant and Downloads the maintenance virtual machine.

The install script should install a shortcut to start the app. Otherwise it can be started from the command line, from inside the ```ltfhc-maintenance-install``` folder by entering ```vagrant ssh ''```

## Instructions

### Connectivity


### Diagnostic


### Upgrade 


### Data Download


### Options

 - Install: Download ltfhc-maintenance-install.bat file and double click.
     *  Install vagrant, virtualbox
     *  Download vagrant box (which includes ansible, ltfhc-maintenance and ltfhc-config)
 - Run: Double click icon on Desktop.
 - Operate: Use arrows and enter key.
 - Report: Drag and drop log file in email.

