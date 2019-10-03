Vlocity ES Tools (Beta)
==============

###### Disclaimer: This tool is not an offical tool from Vlocity. It was created with the intent of distributing certain uitlility tools, Use it at your own risk.

<!-- install -->
# Install
```sh-session
$ sfdx plugins:install vlocityestools
```

# Usage
```sh-session
$ sfdx COMMAND
running command...

$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
```

# Commands

## deleteOldOS

Delete old verions of OmniScritps and leave X amount of latest verions

```
USAGE

  $ sfdx vlocityestools:clean:omniscrtips -u <string>- v <integer>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -n, --numberversions=numberversions                       Number of most recent versions of
                                                            OmniScrits to keep for each one.
                                                            Has to be grater than 0.

EXAMPLES

  $ sfdx vlocityestools:clean:omniscrtips -u myOrg@example.com -n 5
  
  $ sfdx vlocityestools:clean:omniscrtips --targetusername myOrg@example.com --numberversions 5

```
