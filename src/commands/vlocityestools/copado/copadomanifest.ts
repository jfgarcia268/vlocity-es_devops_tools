import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");
const xml2js = require("xml2js");

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'copadomanifest');

export default class copadomanifest extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:copado:copadomanifest -p Package.xml
  `,
  `$ sfdx vlocityestools:copado:copadomanifest --package Package.xml
  `
  ];

  public static args = [{name: 'file'}];


  protected static flagsConfig = {
    package: flags.string({char: 'p', required: true, description: messages.getMessage('package')}),
  };

  public async run() {

    var packagefile = this.flags.package;
    var doc = fsExtra.readFileSync(packagefile, 'utf8');

    var date = this.getDate();

    var copadoManifest = await this.formatPackageXML(doc,date);
    var manifestText = await JSON.stringify(copadoManifest);
    var newFileName = 'CustomMDPreselect.json';
    AppUtils.log3('Creating File: ' + newFileName);
    await fsExtra.writeFile(newFileName, manifestText, function (err) {
      if (err) throw err;
      AppUtils.log3('File is created successfully.');
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

  formatPackageXML(xml, date) {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xml, (err, result) => {
            if (err) {
              reject(err);
            } else {
              //console.log(result);
              AppUtils.log4('Parsing: ' + this.flags.package);
              var copadoManifest = this.parseXML(result,date)
              resolve(copadoManifest);
            }
        });
    });
  }

  parseXML(data,date) {
    var copadoManifest = [];
    var mdTypes = data["Package"]["types"];
    for (const key in mdTypes) {
        const element = mdTypes[key];
        var mdType = element.name[0];
        AppUtils.log2(mdType + ": " + Object.keys(element["members"]).length);
        for (const key2 in element["members"]) {
            const mdname = element["members"][key2];
            let metaDataRecord = {};
            metaDataRecord["t"] = mdType;
            metaDataRecord["n"] = mdname;
            metaDataRecord["b"] = "CopadoBulkUSUpdate";
            metaDataRecord["d"] = date;
            metaDataRecord["cb"] = "CopadoBulkUSUpdate";
            metaDataRecord["cd"] = date;
            metaDataRecord["r"] = false;
            copadoManifest.push(metaDataRecord);
        } 
    }
    return copadoManifest;
  }


  
}
