Vlocity ES Tools (Beta)
==============

###### Disclaimer: This tool is not an offical tool from Vlocity. It was created with the intent of distributing certain uitlility tools, Use it at your own risk.

<!-- install -->
# Install
```sh-session
$ sfdx plugins:instal https://github.com/jfgarcia268/vlocity-es_devops_tools.git
```

# Usage
```sh-session
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
vlocityEStools/0.0.1 darwin-x64 node-v10.16.3
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
```

<!-- commands -->
# Commands

## deleteOldOS

Delete old verions of OmniScritps and leave X amount of latest verions

```
USAGE

  $ sfdx vlocityTools:deleteOldOS -u <string>- v <integer>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -n, --numberversions=numberversions                       Number of most recent versions of
                                                            OmniScrits to keep for each one.
                                                            Has to be grater than 0.

EXAMPLES

  $ sfdx vlocityTools:deleteOldOS -u myOrg@example.com -n 5
  
  $ sfdx vlocityTools:deleteOldOS --targetusername myOrg@example.com --numberversions 5

```
