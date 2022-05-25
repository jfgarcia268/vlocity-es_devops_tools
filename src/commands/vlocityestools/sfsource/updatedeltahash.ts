import { flags, SfdxCommand } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import { AppUtils } from "../../../utils/AppUtils";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("vlocityestools", "updatedeltahash");

export default class updateDeltaHash extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx vlocityestools:sfsource:updatedeltahash  -c DevOpsSettings__c -v DeployKey -u myOrg@example.com
   `,
    `$ sfdx vlocityestools:sfsource:updatedeltahash  --customsettingobject DevOpsSettings__c --gitcheckkeycustom DeployKey --targetusername myOrg@example.com
   `,
    `$ sfdx vlocityestools:sfsource:updatedeltahash  --customsettingobject DevOpsSettings__c --gitcheckkeycustom DeployKey --targetusername myOrg@example.com --customhash 0603ab92ff7cf9adf7ca10228807f6bb6b57a894
   `,
  ];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    gitcheckkeycustom: flags.string({ char: "v", description: messages.getMessage("gitcheckkeycustom")}),
    customsettingobject: flags.string({ char: "c", description: messages.getMessage("customsettingobject")}),
    customhash: flags.string({ char: "h", description: messages.getMessage("customhash")})
  };

  protected static requiresUsername = true;

  public async run() {
    const path = require('path');

    AppUtils.logInitial(messages.getMessage("command"));

    var gitcheckkeycustom = this.flags.gitcheckkeycustom;
    var customsettingobject = this.flags.customsettingobject;

    const repoPath = path.normalize("./");
    const simpleGit = require("simple-git")(repoPath);
    if (!simpleGit.checkIsRepo()) {
      throw new Error("Error: Current directory is not a repository");
    }

    var hashToUpdate;
    var fieldname;

    if(this.flags.customhash != undefined) {
      hashToUpdate = this.flags.customhash;
      AppUtils.log2( "Updating Hash using argument: " + hashToUpdate);
    } else {
      hashToUpdate = updateDeltaHash.getHEADHash();
      AppUtils.log2( "Updating Hash using Current HEAD: " + hashToUpdate);
    }
    if(customsettingobject.indexOf('vlocity_cmt') >= 0){
        fieldname = "vlocity_cmt__Value__c";
    }
    else{
       fieldname = "Value__c";
    }
    const conn = this.org.getConnection();
    AppUtils.log2( "FieldName Updated as: " + fieldname);
    updateDeltaHash.upsertRecord(conn, gitcheckkeycustom, customsettingobject,hashToUpdate,fieldname);
  }

  static upsertRecord(conn, gitcheckkeycustom,customsettingobject,hashToUpdate,fieldname) {
    var settings = {};
    settings['Name'] = gitcheckkeycustom;
    settings[fieldname] = hashToUpdate + "";
    conn.sobject(customsettingobject).upsert( settings , 'Name', function(err, ret) {
      if (err || !ret.success) 
      { 
        throw new Error("Error Upserting Record: " + err);
      }
      AppUtils.log2( "Hash Upserted Successfully: " + hashToUpdate);
    });

  }
  static getHEADHash() {
    return require('child_process').execSync('git rev-parse HEAD'); 
  }
  
}
