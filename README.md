Vlocity ES Tools (Beta)
==============

##### Disclaimer: This tool is not an offical tool from Vlocity or Salesforce. It was created with the intent of distributing certain uitlility tools, Use it at your own risk.


# Install
```sh-session
$ sfdx plugins:install vlocityestools # Requires SFDX-CLI
```

# Usage
```sh-session
$ sfdx COMMAND
running command...

$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
```

# Commands:

### vlocityestools:clean:omniscripts
### vlocityestools:clean:templates
### vlocityestools:compare:folders
### vlocityestools:clean:datapacks
### vlocityestools:clean:savedomniscripts
### vlocityestools:report:dependencies:local
### vlocityestools:report:dependencies:remote
### vlocityestools:report:activeomniscript
### vlocityestools:sfsource:createdeltapackage
### vlocityestools:sfsource:updatedeltahash
### vlocityestools:clean:calcmatrix
### vlocityestools:login:login
  
'    '

# Commands Info:

## vlocityestools:clean:omniscripts

Delete old versions of OmniScritps and leave N amount of latest versions
Active versions will be ignored and wont get deleted.

```
USAGE

  $ sfdx vlocityestools:clean:omniscripts -u <string> -n <integer> -p <string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -n, --numberversions=numberversions                       Number of most recent versions of
                                                            OmniScrits to keep for each one.
                                                            Has to be greater than 0.

  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 

EXAMPLES

  $ sfdx vlocityestools:clean:omniscripts -u myOrg@example.com -n 10 -p cmt
  
  $ sfdx vlocityestools:clean:omniscripts --targetusername myOrg@example.com --numberversions 10 --package ins

```


## vlocityestools:clean:templates

Delete old versions of Templates and leave N amount of latest versions.
Active versions will be ignored and wont get deleted.

```
USAGE

  $ sfdx vlocityestools:clean:templates -u <string> -n <integer> -p <string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -n, --numberversions=numberversions                       Number of most recent versions of
                                                            Templates to keep for each one.
                                                            Has to be greater than 1.

  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 

EXAMPLES

  $ sfdx vlocityestools:clean:templates -u myOrg@example.com -n 5 -p cmt
  
  $ sfdx vlocityestools:clean:templates --targetusername myOrg@example.com --numberversions 5 --package ins

```

## vlocityestools:clean:datapacks

Delete old DataPacks Used by Vlocity Build Tool

```
USAGE

  $ sfdx vlocityestools:clean:datapacks -u <string> -p <string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 

EXAMPLES

  $ sfdx vlocityestools:clean:datapacks -u myOrg@example.com  -p cmt
  
  $ sfdx vlocityestools:clean:datapacks --targetusername myOrg@example.com  --package ins

```

## vlocityestools:clean:savedomniscripts

Delete old Saved OmniScripts

```
USAGE

  $ sfdx vlocityestools:clean:savedomniscripts -u <string> -p <string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 

EXAMPLES

  $ sfdx vlocityestools:clean:savedomniscripts -u myOrg@example.com  -p cmt
  
  $ sfdx vlocityestools:clean:savedomniscripts --targetusername myOrg@example.com  --package ins

```

## vlocityestools:compare:folders

Compare two local Vlocity Metadata folder 
The output will be a CSV file with the results

```
USAGE

  $ sfdx vlocityestools:compare:folders -s <string>- t <integer>

OPTIONS

  -s, --folder1=folder1                                   Vlocity Folder 1 to Compare
                                                

  -t, --folder2=folder2                                   Vlocity Folder 2 to Compare
  


EXAMPLES

  $ sfdx vlocityestools:compare:folders -s vlocity1 -t vlocity2
  
  $ sfdx vlocityestools:compare:folders --folder1 vlocity1 --folder2 vlocity2

```


## vlocityestools:report:dependencies:local


From a local DataPack export foler, for Both OmniScript and VIP, 1st Level of dependencies: 

- DataRaptors
- OmniScripts
- VIPS
- Remote Calls
- VlocityUITemplate

The output will be a CSV file with the results


```
USAGE

  $ sfdx vlocityestools:report:dependencies:local -f <string>

OPTIONS

  -f, --folder=folder                                  Vlocity Folder Name
                                                
  

EXAMPLES

  $ sfdx vlocityestools:report:dependencies:local -f vlocity
  
  $ sfdx vlocityestools:report:dependencies:local --folder vlocity

```

## vlocityestools:report:dependencies:remote

From remote Alias connection, for Both OmniScript and VIP, 1st Level of dependencies: 

- DataRaptors
- OmniScripts
- VIPS
- Remote Calls
- VlocityUITemplate

The output will be a CSV file with the results


```
USAGE

  $ sfdx vlocityestools:report:dependencies:remote -u <string> -p <string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 
                                                
  

EXAMPLES

  $ sfdx vlocityestools:report:dependencies:remote -u SIT -p cmt
  
  $ sfdx vlocityestools:report:dependencies:remote --targetusername myOrg@example.com  --packageType ins

```

## vlocityestools:report:activeomniscript

Check All OmniScrips are Active

```
USAGE

  $ sfdx vlocityestools:report:activeomniscript -u <string> -p <string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 
                                                
  

EXAMPLES

  $ sfdx vlocityestools:report:activeomniscript -u myOrg@example.com -p cmt
  
  $ sfdx vlocityestools:report:activeomniscript  --targetusername myOrg@example.com --package ins

```

## vlocityestools:sfsource:createdeltapackage

Based on Vlocity Build Tool saved Hash in the Environment, Create Delta package for salforce.
Note: Only works for SFDX Source Format

--gitcheckkeycustom and --customsettingobject can be used to use a Custom "Custom Settings". For this: Create a new Custom Setting, the API name will be --customsettingobject. This Custom Setting will have two fields "Name" and the value of it will be the "--gitcheckkeycustom" and a field "Value__c" that will contain tha hash.


```
USAGE,

  $ sfdx vlocityestools:sfsource:createdeltapackage -u <string> -d<string> [-k <string>] [-p <string>] [-c <string> -v <string>]

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -p, --package=package                                     (Optional) Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 

  -d, --sourcefolder=sourcefolder                           Salesfroce sorce folder name

  -k, --gitcheckkey=gitcheckkey                             (Optional) Key when using gitCheckKey with Build Tool

OPTIONS IF USING a Custom "Custom Settings"

  -c, --customsettingobject=customsettingobject             (Optional) Optional Custom Setting API Name when using custom one

  -v, --gitcheckkeycustom=gitcheckkeycustom                 (Optional) Custom Setting record Name when using --customsettingobject, -c 

                                                           
                          

EXAMPLES

  $ sfdx vlocityestools:sfsource:createdeltapackage -u myOrg@example.com -p cmt -d force-app
  
  $ sfdx vlocityestools:sfsource:createdeltapackage --targetusername myOrg@example.com --package ins --sourcefolder force-app

  $ sfdx vlocityestools:sfsource:createdeltapackage --targetusername myOrg@example.com --package ins --sourcefolder force-app --gitcheckkey EPC

  $ sfdx vlocityestools:sfsource:createdeltapackage --targetusername myOrg@example.com --sourcefolder force-app --gitcheckkeykustom VBTDeployKey --customsettingobject DevOpsSettings__c

```

## vlocityestools:sfsource:updatedeltahash

When using a Custom "Custom Setting" Object for delta Package. You can update the hash in the environment using this command.

```
USAGE,

  $ sfdx vlocityestools:sfsource:createdeltapackage -u <string> -p <string> -d<string> [-h <string>]

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -c, --customsettingobject=customsettingobject             Custom Setting Object API Name 

  -v, --gitcheckkeycustom=gitcheckkeycustom                 Custom Setting record Name

  -h, --customhash=customhash                               (Optional) Custom Hash Value to be updated

                                                           
                          

EXAMPLES

  $ sfdx vlocityestools:sfsource:updatedeltahash  -c DevOpsSettings__c -v DeployKey -u myOrg@example.com

  $ sfdx vlocityestools:sfsource:updatedeltahash  --customsettingobject DevOpsSettings__c --gitcheckkeycustom DeployKey --targetusername myOrg@example.com
   
  $ sfdx vlocityestools:sfsource:updatedeltahash  --customsettingobject DevOpsSettings__c --gitcheckkeycustom DeployKey --targetusername myOrg@example.com -- 0603ab92ff7cf9adf7ca10228807f6bb6b57a894

```

## vlocityestools:clean:calcmatrix

This command will delete all rows of the Calculation Matrix Version based on the given ID as input. Then, it will update the version record with Dummy data so any other version can be Deployed. The Calculation Matrix Version can be delete after 24 hors due to Salesforce sweeper restrictions.
You can assign the user used to run this comnad a Permisison set or a profile that has the Bulk API hard delte to avoid the need of deleting the rows from the recycle bin.

```
USAGE

  $ sfdx vlocityestools:clean:calcmatrix -u <string> -i <string> -P<string>

OPTIONS

  -u, --targetusername=targetusername                       username or alias for the target
                                                            org; overrides default target org

  -i, --matrixid=matrixid                                   Matrix Version ID to be clean 


  -p, --package=package                                     Vlocity Package Type, Options:
                                                            'cmt' or 'ins' 
                                                           
                          

EXAMPLES

  $ sfdx vlocityestools:clean:calcmatrix -u myOrg@example.com -i a0dR000000kxD4qIAE -p ins
  
  $ sfdx vlocityestools:clean:calcmatrix --targetusername myOrg@example.com --matrixid a0dR000000kxD4qIAE --package cmt

```

## vlocityestools:auth:login

Create an Alias using User and Password,  (Token if needed as wells)
Note: This will not create an Alias with OAuth Connnection so the connection will expired.

```
USAGE

  $ sfdx vlocityestools:auth:login -u <string> -p <string> -a <string> [-l <string>] [-t <string>]

OPTIONS

  -u, --username=username                                   Username to Autenticate

  -p, --password=password                                   Password

  -t, --token=token                                         Token
  
  -l, --url=url                                             Org Url, Default: https://login.salesforce.com

  -a, --alias=alias                                          Alias


                                                                    

EXAMPLES

  $ sfdx vlocityestools:auth:login -u jgonzalez@vlocity.com.de1 -p 'pass123' -t eXUTfa9gpIxfaytnONqnlWFG -a dev1
  
  $ sfdx vlocityestools:auth:login --username jgonzalez@vlocity.com.de1 --password 'pass123' --url 'https://test.salesforce.com' --alias dev1

```