import { flags, SfdxCommand } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import { AppUtils } from "../../../utils/AppUtils";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("vlocityestools", "deltapackage");

export default class deltaPackage extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx vlocityestools:sfsource:createdeltapackage -u myOrg@example.com -p cmt -d force-app
  `,
    `$ sfdx vlocityestools:sfsource:createdeltapackage --targetusername myOrg@example.com --package ins --sourcefolder force-app
  `,
    `$ sfdx vlocityestools:sfsource:createdeltapackage --targetusername myOrg@example.com --package ins --sourcefolder force-app --gitcheckkey EPC
  `,
    `$ sfdx vlocityestools:sfsource:createdeltapackage --targetusername myOrg@example.com --sourcefolder force-app --gitcheckkeycustom VBTDeployKey --customsettingobject DevOpsSettings__c
  `
  ];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    package: flags.string({char: "p", description: messages.getMessage("packageType")}),
    sourcefolder: flags.string({ char: "d", description: messages.getMessage("sourcefolder")}),
    gitcheckkey: flags.string({ char: "k", description: messages.getMessage("gitcheckkey")}),
    gitcheckkeycustom: flags.string({ char: "v", description: messages.getMessage("gitcheckkeycustom")}),
    customsettingobject: flags.string({ char: "c", description: messages.getMessage("customsettingobject")})
  };

  protected static requiresUsername = true;

  public async run() {
    const fsExtra = require("fs-extra");
    const path = require('path');

    AppUtils.logInitial(messages.getMessage("command"));

    var packageType = this.flags.package;
    var sourceFolder = this.flags.sourcefolder;
    var deployKey = "VBTDeployKey";
    var gitcheckkeycustom = this.flags.gitcheckkeycustom;
    var customsettingobject = this.flags.customsettingobject;

    if(customsettingobject != undefined && gitcheckkeycustom == undefined) {
      throw new Error("Error: -v, --gitcheckkeycustom needs to passed when using customsettingobject");
    }

    if(gitcheckkeycustom != undefined && customsettingobject == undefined) {
      throw new Error("Error: -c, --customsettingobject needs to passed when using gitcheckkeycustom");
    }

    //console.log("this.flags.gitcheckkey: " + this.flags.gitcheckkey);

    if(this.flags.gitcheckkey != undefined) {
      deployKey = deployKey + this.flags.gitcheckkey;
    }
    //console.log("deployKey: " + deployKey);
    
    var deltaPackageFolder = sourceFolder + '_delta';

    if (customsettingobject == undefined) {
      if (packageType == "cmt") {
        AppUtils.namespace = "vlocity_cmt__";
      } else if (packageType == "ins") {
        AppUtils.namespace = "vlocity_ins__";
      } else {
        throw new Error("Error: -p, --package has to be either cmt or ins ");
      }
    }

    const conn = this.org.getConnection();

    var query;

    if(customsettingobject != undefined) {
      query = "SELECT Name, Value__c FROM " + customsettingobject + " WHERE Name = '" + gitcheckkeycustom + "'";
    }
    else {
      const initialQuery = "SELECT Name, %name-space%Value__c FROM %name-space%GeneralSettings__c WHERE Name = '" + deployKey + "'";
      query = AppUtils.replaceaNameSpace(initialQuery);
    }

    //console.log("query: " + query);
    const result = await conn.query(query);
    const repoPath = path.normalize("./");
    const simpleGit = require("simple-git")(repoPath);
    if (result.records.length < 1) {
      AppUtils.log3("Hash not found in the environment, Coping full Package");
      deltaPackage.copyCompleteFolder(sourceFolder, deltaPackageFolder, fsExtra);
    } else if (!simpleGit.checkIsRepo()) {
      throw new Error("Error: Current directory is not a repository");
    } else {
      var previousHash;
      if(customsettingobject != undefined) {
        previousHash = result.records[0][AppUtils.replaceaNameSpace("Value__c")];
      }
      else {
        previousHash = result.records[0][AppUtils.replaceaNameSpace("%name-space%Value__c")];
      }
      if( previousHash == undefined || previousHash == null ){
        throw new Error("Custom Setting record found but Hash is empty.. Nothing was copied  ");
      }
      else {
        AppUtils.log2("Hash found in the environment: " + previousHash);
        if (fsExtra.existsSync(deltaPackageFolder)) {
          AppUtils.log2("Old delta folder was found... deleting before creating new delta: " + deltaPackageFolder );
          fsExtra.removeSync(deltaPackageFolder);
        }
        deltaPackage.doDelta(simpleGit, sourceFolder, deltaPackageFolder, fsExtra, previousHash,path);
      }
    }    
  }

  static copyCompleteFolder(sourceFolder, deltaPackageFolder, fsExtra) {
    if (fsExtra.existsSync(deltaPackageFolder)) {
      fsExtra.removeSync(deltaPackageFolder);
    }
    fsExtra.mkdirSync(deltaPackageFolder);
    fsExtra.copySync(sourceFolder, deltaPackageFolder);
  }
  static doDelta(simpleGit, sourceFolder, deltaPackageFolder, fsExtra, previousHash,path) {
    simpleGit.diffSummary([previousHash], (err, status) => {
      if (err) {
        throw new Error( "Error with GitDiff, Nothing was copied - Error: " + err );
        //deltaPackage.copyCompleteFolder( sourceFolder, deltaPackageFolder, fsExtra);
      } else {
        var numOfDiffs = status.files.length;
        if (numOfDiffs > 0) {
          AppUtils.log3("Creating delta Folder: " + deltaPackageFolder);
          AppUtils.log3("Checking GitDiff.. Deltas: ");
          status.files.forEach(files => {
            //console.log('File: ' + files.file);
            var filePath = files.file;
            if (fsExtra.existsSync(filePath) && filePath.includes(sourceFolder)) {
              var newfilePath = filePath.replace(sourceFolder,deltaPackageFolder);
              AppUtils.log2("Delta File: " + filePath); //+ ' /////// newfilePath: ' + newfilePath);
              var splitResult = filePath.split(path.sep);

              if (filePath.includes(path.sep + "staticresources" + path.sep)) {
                /**
                 * Static Resources Scenario
                 */   
                var newCompPath = filePath.replace(sourceFolder, deltaPackageFolder);
                if (!fsExtra.existsSync(newCompPath)) {
                  AppUtils.log1("Looking for Files to move for Static Resources Change ");
                  var staticResourceFolder = filePath.match(/.*\/staticresources\/.*?/)[0];
                  var mainFileOrfolder = filePath.replace(staticResourceFolder,'').split(path.sep)[0];
                  var mainFileOrfolderPath = staticResourceFolder + mainFileOrfolder;
                  //console.log('mainFileOrfolderPath: ' + mainFileOrfolderPath);
                  var stats = fsExtra.statSync(mainFileOrfolderPath);
                  if(stats.isDirectory()){
                    var newFoldePath = mainFileOrfolderPath.replace(sourceFolder,deltaPackageFolder);
                    if (fsExtra.existsSync(mainFileOrfolderPath)) {
                      AppUtils.log1("Moving complete folder: " + newFoldePath);
                      fsExtra.copySync(mainFileOrfolderPath, newFoldePath);
                    }
                    var metaFileForFolder = mainFileOrfolderPath + '.resource-meta.xml';
                    if (fsExtra.existsSync(metaFileForFolder)) {
                      var newMetaFileForFolder = metaFileForFolder.replace(sourceFolder,deltaPackageFolder);
                      AppUtils.log1("Moving Meta File: " + newMetaFileForFolder);
                      fsExtra.copySync(metaFileForFolder, newMetaFileForFolder);
                    }
                  } else {
                    var fileNameNoExt = mainFileOrfolder.split('.')[0];
                    //console.log('fileNameNoExt: ' + fileNameNoExt);
                    var files = fsExtra.readdirSync(staticResourceFolder);
                    files.forEach(fileInStaticResourcesFolder => {
                      if(fileInStaticResourcesFolder.includes(fileNameNoExt)){
                        //console.log('fileInStaticResourcesFolder: '+fileInStaticResourcesFolder);
                        var pathforFounded = staticResourceFolder + fileInStaticResourcesFolder;
                        var newPathforFounded = pathforFounded.replace(sourceFolder, deltaPackageFolder);
                        AppUtils.log1("Moving File/Folder for Static Resources Change. New path: " + newPathforFounded);
                        fsExtra.copySync(pathforFounded, newPathforFounded);
                      }  
                    });
                  }
                } else {
                  AppUtils.log1("Skiped - MetaData alredy moved: " + newCompPath);
                } 
              } else if (  filePath.includes(path.sep + "aura" + path.sep) || filePath.includes(path.sep + "lwc" + path.sep) || filePath.includes(path.sep + "experiences" + path.sep )) {
                /**
                 *  Cases when we need to copy the complete folder when a change happne inside the folder.
                 */
                var CompPath;
                if (filePath.includes(".site-meta.xml")) {
                  CompPath = filePath.substring(0, filePath.length - 14);
                  var newMetaFileForSite = filePath.replace(sourceFolder, deltaPackageFolder);
                  AppUtils.log1("Moving Meta File for Experience Bundle: " + newMetaFileForSite);
                  fsExtra.copySync(filePath, newMetaFileForSite);
                } else if (filePath.includes(path.sep + "experiences" + path.sep)){
                  var compFileName = splitResult[splitResult.length - 1];
                  var compFileName2 = splitResult[splitResult.length - 2];
                  CompPath = filePath.substring(0, filePath.length - compFileName.length - compFileName2.length - 2);
                } else {
                  var compFileName = splitResult[splitResult.length - 1];
                  var CompPath = filePath.substring(0, filePath.length - compFileName.length - 1);
                }

                var newCompPath = CompPath.replace(sourceFolder, deltaPackageFolder);

                if (fsExtra.existsSync(newCompPath) == false) {
                  AppUtils.log1("Moving Complete folder for changed file... New path: " + newCompPath);
                  fsExtra.copySync(CompPath, newCompPath);
                  if (filePath.includes(path.sep + "experiences" + path.sep)) {
                    var CompPathXML = CompPath + ".site-meta.xml";
                    var newCompPathXML = newCompPath + ".site-meta.xml";
                    if (fsExtra.existsSync(CompPathXML)) {
                      AppUtils.log1("Moving Meta File for folder. New path: " + newCompPathXML);
                      fsExtra.copySync(CompPathXML, newCompPathXML);
                    }
                  } 
                } 
                else {
                  AppUtils.log1("Skiped - MetaData alredy moved: " + newCompPath);
                }
              } else {

                /**
                 *  Generic Copy for all changed Files
                 */
                AppUtils.log1("Moving changed file. New path: " + newfilePath);
                fsExtra.copySync(filePath, newfilePath);

                /**
                 *  If a Meta File has chaged, look for the actual Metadata
                 */
                if(filePath.includes("-meta.xml") && !filePath.includes("experiences")) {
                  var nonMetaFilePath = filePath.substring(0, filePath.length - 9);
                  var nonMetaFileNewfilePath = newfilePath.substring(0, newfilePath.length - 9);
                  if (fsExtra.existsSync(nonMetaFilePath)) {
                    AppUtils.log1("Moving File for Changed Meta. New path: " + nonMetaFileNewfilePath);
                    fsExtra.copySync(nonMetaFilePath, nonMetaFileNewfilePath);
                  }
                } 
                /**
                 * Look if the Metada needs a Meta File 
                 */
                var metaXMLFile = filePath + "-meta.xml";
                if (fsExtra.existsSync(metaXMLFile)) {
                  var newMetaXMLFile = newfilePath + "-meta.xml";
                  AppUtils.log1("Moving meta File for changed file. New path: " + newMetaXMLFile);
                  fsExtra.copySync(metaXMLFile, newMetaXMLFile);
                }

              }
            }
          });
          if (!fsExtra.existsSync(deltaPackageFolder)){
            AppUtils.log2("No modified files found to copy to the delta folder.. Delta folder was not created");
          }
        } else {
          AppUtils.log2("No Diffs Found");
        }
      }
    });
  }
}
