import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");
const yaml = require('js-yaml');

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'copadomanifest');

export default class copadomanifest extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:copado:copadomanifest -p package.xml
  `,
  `$ sfdx vlocityestools:copado:copadomanifest --package package.xml --username User123 --vlocity
  `
  ];

  public static args = [{name: 'file'}];


  protected static flagsConfig = {
    package: flags.string({char: 'p', required: true, description: messages.getMessage('package')}),
    username: flags.string({char: 'n', required: false, description: messages.getMessage('username')}),
    vlocity: flags.boolean({char: 's', required: false, description: messages.getMessage('vlocity')})
  };

  public async run() {
    var newFileName = 'CustomMDPreselect.json';
    if(!this.flags.vlocity) {
      AppUtils.logInitial(messages.getMessage('command')); 
      AppUtils.ux = this.ux;
      var packagefile = this.flags.package; 
      AppUtils.log4("Creating Copado User Story Manifest");
      AppUtils.log3('Extracting data from: ' + this.flags.package);
      var doc = fsExtra.readFileSync(packagefile, 'utf8'); 
      var copadoManifestXML = await AppUtils.extractXML(doc);
      AppUtils.log1('Done');
      AppUtils.log3('Parsing data...');
      var copadoManifest = this.parseXML(copadoManifestXML);
      AppUtils.log1('Done');
      var manifestText = await JSON.stringify(copadoManifest);
      AppUtils.log3('Creating File: ' + newFileName);
      this.saveFile(newFileName,manifestText);
    } else {
      var packagefile = this.flags.package; 
      AppUtils.log4("Creating Copado User Story Manifest");
      AppUtils.log3('Extracting data from: ' + this.flags.package);
      var data = yaml.safeLoad(fsExtra.readFileSync(packagefile, 'utf8'))["manifest"];
      var copadoManifest = this.parseXMLVlocity(data);
      AppUtils.log1('Done');
      AppUtils.log3('Parsing data...');
      var manifestText = await JSON.stringify(copadoManifest);
      AppUtils.log3('Creating File: ' + newFileName);
      this.saveFile(newFileName,manifestText);
    }
  }

  async saveFile(newFileName,manifestText){
    if (fsExtra.existsSync(newFileName)) {
      AppUtils.log1('Deleting Old file...');
      fsExtra.unlinkSync(newFileName);
    }
    await fsExtra.writeFile(newFileName, manifestText, function (err) {
      if (err) throw err;
      AppUtils.log2('File is created successfully.');
    });
  }

  getDate(){
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var yyyy = today.getFullYear();
    var date = yyyy + '/' + mm + '/' + dd;
    return date;
  }

  parseXML(data) {
    var username = this.flags.username?this.flags.username:"None";
    var date = this.getDate();
    var copadoManifest = [];
    var mdTypes = data["Package"]["types"];
    for (const key in mdTypes) {
        const element = mdTypes[key];
        var mdType = element.name[0];
        AppUtils.log2(mdType + ": " + Object.keys(element["members"]).length);
        for (const key2 in element["members"]) {
            const mdname = element["members"][key2];
            let metaDataRecord = {};
            metaDataRecord["t"]  = mdType;
            metaDataRecord["n"]  = mdname;
            metaDataRecord["b"]  = username;
            metaDataRecord["d"]  = date;
            metaDataRecord["cb"] = username;
            metaDataRecord["cd"] = date;
            metaDataRecord["r"]  = false;
            copadoManifest.push(metaDataRecord);
        } 
    }
    return copadoManifest;
  }

  parseXMLVlocity(data) {
    var copadoManifest = [];
    for (const key in data) {
      const element = data[key];
      const words = element.split('/');
      var type = words[0];
      var name = words[1];
      var username = this.flags.username?this.flags.username:"None";
      var date = this.getDate();
      let metaDataRecord = {};
      metaDataRecord["t"]  = type;
      metaDataRecord["n"]  = name;
      metaDataRecord["b"]  = username;
      metaDataRecord["d"]  = date;
      metaDataRecord["cb"] = username;
      metaDataRecord["cd"] = date;
      metaDataRecord["r"]  = false;
      metaDataRecord["vk"]  = element;
      copadoManifest.push(metaDataRecord);
      //console.log(type + '/' +name);  
    }
    return copadoManifest;
  }


  
}
