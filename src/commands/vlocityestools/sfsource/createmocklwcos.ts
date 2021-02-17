import { flags, SfdxCommand } from "@salesforce/command";
import { Messages, SfdxError } from "@salesforce/core";
import { AppUtils } from "../../../utils/AppUtils";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("vlocityestools", "createmocklwcos");

const fsExtra = require("fs-extra");
const path = require('path');

export default class createMockLWCOS extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx vlocityestools:sfsource:createmocklwcos -u myOrg@example.com -d vlocity
  `,
    `$ sfdx vlocityestools:sfsource:createmocklwcos --targetusername myOrg@example.com --datapacksfolder vlocity
  `
  ];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    package: flags.string({char: "p", description: messages.getMessage("packageType")}),
    datapacksfolder: flags.string({ char: "d", description: messages.getMessage("datapacksfolder")})
  };

  protected static requiresUsername = true;

  public async run() {

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage("command"));
    AppUtils.ux.log(' ');

    var packageType = this.flags.package;
    var datapacksfolder = this.flags.datapacksfolder;

    if (!fsExtra.existsSync(datapacksfolder)) {
      throw new Error("Folder '" + datapacksfolder + "'  not found");
    }

    const conn = this.org.getConnection();

    var nameSpaceSet = await AppUtils.setNameSpace(conn,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    }

    this.getMockLWCForOS(conn,datapacksfolder);

  }


  public async getMockLWCForOS(conn,datapacksfolder) {
    AppUtils.log3("Getting OmniScript Map from Org");
    var orgOSMap = await this.getOrgLWCOSMap(conn);
    AppUtils.log3("Getting OmniScript Map from Local");
    var localOSMap = await this.localLWCOSMap(datapacksfolder);
    var localOSkeys = Object.keys(localOSMap);

    var missingLWC = {};
    AppUtils.log3("Missin LWC: ");
    for (let i = 0; i < localOSkeys.length; i++) {
      const element = localOSkeys[i];
      if (!orgOSMap[element]) {
        missingLWC[element] = localOSMap[element];
        AppUtils.log1(element );
      }
    }

    if (Object.keys(missingLWC).length > 0){
      this.createOrgLwc(conn,missingLWC);
    }

  }

  public async createOrgLwc(conn,missingLWC){
    var keys = Object.keys(missingLWC);
    for (let i = 0; i < keys.length; i++) {
      const element = keys[i];
      AppUtils.log3("Creating LWC: " + element);
      var metadata = [];
      var tempLwc = {};
      tempLwc["fullName"] = element;
      tempLwc["masterLabel"] = missingLWC[element];
      metadata.push(tempLwc);
      //console.log(metadata);
      await conn.metadata.create('LightningComponentBundle', metadata, function(err, results) {
        //console.log(results);
        if (err) { 
          console.log("Error: " + err); 
        }
        if(results.success){
          AppUtils.log2("Mock LWC Created" + element);
        } else {
          AppUtils.log2("Error: " + results.errors.message);
        }
      });
    }

  }


  public async localLWCOSMap(datapacksfolder){
    const osFolder = datapacksfolder + path.sep + 'OmniScript'
    var omniScriptMap = {};
    var folders = fsExtra.readdirSync(osFolder);
    for (let i = 0; i < folders.length; i++) {
      const oSFolderName = folders[i];
      var folderPath = osFolder + path.sep + oSFolderName
      if (fsExtra.lstatSync(folderPath).isDirectory()){
        var dataPackFile = folderPath + path.sep +  oSFolderName + "_DataPack.json";
        let fileData = fsExtra.readFileSync(dataPackFile);
        let OSDataPack = JSON.parse(fileData);
        var isLWC = OSDataPack["%vlocity_namespace%__IsLwcEnabled__c"];
        if (isLWC){
          //console.log(omniScriptMap);
          //console.log(oSFolderName);
          var key = oSFolderName.replace(/_/g, "");
          omniScriptMap[key] = oSFolderName.replace(/_/g, "/");
        }
      }
    }
   return omniScriptMap;
  }

  public async getOrgLWCOSMap(conn){
    var query = "SELECT %name-space%Type__c, %name-space%SubType__c, %name-space%Language__c FROM %name-space%OmniScript__c WHERE %name-space%IsLwcEnabled__c = true";
    query = AppUtils.replaceaNameSpace(query);
    var omniScriptMap = {};
    const result = await conn.query(query);
    if (result.records && result.records.length > 0) {
      for (let i = 0; i < result.records .length; i++) {
        const resultOmniScript = result.records [i];
        var type = resultOmniScript[AppUtils.replaceaNameSpace("%name-space%Type__c")];
        var subType = resultOmniScript[AppUtils.replaceaNameSpace("%name-space%SubType__c")];
        var Language = resultOmniScript[AppUtils.replaceaNameSpace("%name-space%Language__c")];
        var key = type + subType + Language;
        var label = type + "/" + subType + "/" + Language;
        //console.log(key);
        omniScriptMap[key] = key;
      }
    } 
    return omniScriptMap
  }

}
