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
  `
  ];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    package: flags.string({char: "p", description: messages.getMessage("packageType")}),
    sourcefolder: flags.string({ char: "d", description: messages.getMessage("sourcefolder")}),
    gitcheckkey: flags.string({ char: "k", description: messages.getMessage("gitcheckkey")})
  };

  protected static requiresUsername = true;

  public async run() {
    const fsExtra = require("fs-extra");
    const path = require('path');

    AppUtils.logInitial(messages.getMessage("command"));

    var packageType = this.flags.package;
    var sourceFolder = this.flags.sourcefolder;
    var deployKey = "VBTDeployKey";
    //console.log("this.flags.gitcheckkey: " + this.flags.gitcheckkey);

    if(this.flags.gitcheckkey != undefined) {
      deployKey = deployKey + this.flags.gitcheckkey;
    }
    //console.log("deployKey: " + deployKey);
    
    var deltaPackageFolder = sourceFolder + '_delta';

    if (packageType == "cmt") {
      AppUtils.namespace = "vlocity_cmt__";
    } else if (packageType == "ins") {
      AppUtils.namespace = "vlocity_ins__";
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }

    const conn = this.org.getConnection();
    const initialQuery = "SELECT Name, %name-space%Value__c FROM %name-space%GeneralSettings__c WHERE Name = '" + deployKey + "'";
    const query = AppUtils.replaceaNameSpace(initialQuery);
    //console.log("query: " + query);
    const result = await conn.query(query);
    const repoPath = path.normalize("./");
    const simpleGit = require("simple-git")(repoPath);
    if (result.records.length < 1) {
      AppUtils.log2("Hash not found in the environment, Coping full Package");
      deltaPackage.copyCompleteFolder(sourceFolder, deltaPackageFolder, fsExtra);
    } else if (!simpleGit.checkIsRepo()) {
      AppUtils.log2("Current directory is not a repository");
    } else {
      var previousHash =
        result.records[0][AppUtils.replaceaNameSpace("%name-space%Value__c")];
      AppUtils.log2("Hash found in the environment: " + previousHash);
      if (fsExtra.existsSync(deltaPackageFolder)) {
        fsExtra.removeSync(deltaPackageFolder);
      }
      deltaPackage.doDelta(simpleGit, sourceFolder, deltaPackageFolder, fsExtra, previousHash,path);
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
        AppUtils.log2( "Error with GitDiff, Nothing was copied - Error: " + err );
        //deltaPackage.copyCompleteFolder( sourceFolder, deltaPackageFolder, fsExtra);
      } else {
        var numOfDiffs = status.files.length;
        if (numOfDiffs > 0) {
          AppUtils.log2("Creating delta Package...");
          AppUtils.log2("Deltas: ");
          status.files.forEach(files => {
            //console.log('File: ' + files.file);
            var filePath = files.file;
            if (fsExtra.existsSync(filePath) && filePath.includes(sourceFolder)) {
              var newfilePath = filePath.replace(sourceFolder,deltaPackageFolder);
              AppUtils.log2("Delta File: " + filePath); //+ ' /////// newfilePath: ' + newfilePath);
              if (filePath.includes(path.sep + "aura" + path.sep) || filePath.includes(path.sep + "lwc" + path.sep) || filePath.includes(path.sep + "experiences" + path.sep)) {
                var splitResult = filePath.split(path.sep);
                var CompPath = splitResult[0] + path.sep + splitResult[1] + path.sep + splitResult[2] + path.sep + splitResult[3] + path.sep + splitResult[4];
                var newCompPath = CompPath.replace(sourceFolder, deltaPackageFolder);
                //console.log('CompPath: ' + CompPath + ' /////// newCompPath: ' + newCompPath);
                if (fsExtra.existsSync(newCompPath) == false) {
                  AppUtils.log1("Moving changed file. New path: " + newCompPath);
                  fsExtra.copySync(CompPath, newCompPath);
                  if (filePath.includes(path.sep + "experiences" + path.sep)) {
                    var CompPathXML = CompPath + ".site-meta.xml";
                    var newCompPathXML = newCompPath + ".site-meta.xml";
                    if (fsExtra.existsSync(CompPathXML)) {
                      AppUtils.log1("Moving changed file. New path: " + newCompPathXML);
                      fsExtra.copySync(CompPathXML, newCompPathXML);
                    }
                  }
                }
                else {
                  AppUtils.log1("MetaData alredy moved: " + newCompPath);
                }
              } else {
                if(filePath.includes("-meta.xml") && !filePath.includes("staticresources") ) {
                  var nonMetaFilePath = filePath.substring(0, filePath.length - 9);
                  var nonMetaFileNewfilePath = newfilePath.substring(0, newfilePath.length - 9);
                  if (fsExtra.existsSync(nonMetaFilePath)) {
                    AppUtils.log1("Moving changed file. New path: " + nonMetaFileNewfilePath);
                    fsExtra.copySync(nonMetaFilePath, nonMetaFileNewfilePath);
                  }
                } 
        
                AppUtils.log1("Moving changed file. New path: " + newfilePath);
                fsExtra.copySync(filePath, newfilePath);

                var metaXMLFile = filePath + "-meta.xml";
                if (fsExtra.existsSync(metaXMLFile)) {
                  var newMetaXMLFile = newfilePath + "-meta.xml";
                  AppUtils.log1("Moving changed file. New path: " + newMetaXMLFile);
                  fsExtra.copySync(metaXMLFile, newMetaXMLFile);
                }

                if(filePath.includes("staticresources")) {
                  var splitResultSR = filePath.split(path.sep);
                  var staticResourceMetaFile = splitResultSR[0] + path.sep + splitResultSR[1] + path.sep + splitResultSR[2] + path.sep + splitResultSR[3] + path.sep + splitResultSR[4] + ".resource-meta.xml";
                  var newStaticResourceMetaFile = staticResourceMetaFile.replace(sourceFolder, deltaPackageFolder);
                  //console.log("////// CompPath: " + newStaticResourceMetaFile);
                  if (fsExtra.existsSync(staticResourceMetaFile)) {
                    AppUtils.log1("Moving changed file. New path: " + newStaticResourceMetaFile);
                    fsExtra.copySync(staticResourceMetaFile, newStaticResourceMetaFile);
                  }

                } 
              }
            }
          });
        } else {
          AppUtils.log2("No Diffs Found");
        }
      }
    });
  }
}
