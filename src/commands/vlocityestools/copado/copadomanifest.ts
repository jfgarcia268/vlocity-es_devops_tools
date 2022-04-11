import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");
const parseString = require("xml2js").parseString;

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

    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    var date = yyyy + '/' + mm + '/' + dd;

    await this.formatXML(doc,date);
    
  }

   async formatXML(xml,date) {
    await parseString(xml, function (xml, result) {
      AppUtils.log4('Creating File');
      var copadoManifest = [];
      var mdTypes = result["Package"]["types"];
      for (const key in mdTypes) {
          const element = mdTypes[key];
          var mdType = element.name[0];
          AppUtils.log2(mdType);
          for (const key2 in element["members"]) {
              const mdname = element["members"][key2];
              //console.log(mdname);
              let metaDataRecord = {};
              metaDataRecord["t"] = mdType;
              metaDataRecord["n"] = mdname;
              metaDataRecord["b"] = "CopadoBulkUSUpdate";
              metaDataRecord["d"] = date;
              metaDataRecord["cb"] = "CopadoBulkUSUpdate";
              metaDataRecord["cd"] = date;
              metaDataRecord["r"] = false;
              copadoManifest.push(metaDataRecord);
              AppUtils.log1(mdname);
          } 
      }
      //console.log(copadoManifest);
      const manifestText = JSON.stringify(copadoManifest);
      //console.log(manifestText);
      fsExtra.writeFile('CustomMDPreselect.json', manifestText, function (err) {
        if (err) throw err;
        AppUtils.log4('File is created successfully.');
      });

    });
  }
  
}
