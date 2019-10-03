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

## vlocityestools:clean:omniscrtips

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

## vlocityestools:compare:folders

Compare two local Vlocity Metadata folder 

```
USAGE

  $ sfdx vlocityestools:compare:folders -s <string>- t <integer>

OPTIONS

  -s, --folder1=folder1                                   Vlocity Folder 1 to Compare
                                                

  -t, --folder2=folder2                                  Vlocity Folder 2 to Compare
  


EXAMPLES

  $ sfdx vlocityestools:compare:folders -s vlocity1 -t vlocity2
  
  $ sfdx vlocityestools:compare:folders --folder1 vlocity1 --folder2 vlocity2

```
