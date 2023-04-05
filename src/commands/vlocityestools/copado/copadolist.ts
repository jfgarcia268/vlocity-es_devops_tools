import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'copadolist');

export default class copadolist extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:copado:copadolist -m manifest.txt
  `,
  `$ sfdx vlocityestools:copado:copadolist --manifest manifest.txt --username User123
  `
  ];

  public static args = [{name: 'file'}];


  protected static flagsConfig = {
    manifest: flags.string({char: 'm', required: true, description: messages.getMessage('manifest')}),
    username: flags.string({char: 'n', required: false, description: messages.getMessage('username')})
  };

  public async run() {
    var newFileName = 'CustomMDPreselect.json';
    AppUtils.logInitial(messages.getMessage('command')); 
    AppUtils.ux = this.ux;
    var packagefile = this.flags.manifest; 
    AppUtils.log4("Creating Copado User Story Manifest");
    AppUtils.log3('Extracting data from: ' + this.flags.manifest);
    var doc = fsExtra.readFileSync(packagefile, 'utf8'); 
    const lines = doc.split(/\r?\n/);
    AppUtils.log1('Done');
    AppUtils.log3('Parsing data...');
    var copadoManifest = this.parseLines(lines);
    AppUtils.log2('Done');
    var manifestText = await JSON.stringify(copadoManifest);
    AppUtils.log3('Creating File: ' + newFileName);
    this.saveFile(newFileName,manifestText);
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

  parseLines(data) {
    var username = this.flags.username?this.flags.username:"None";
    var date = this.getDate();
    var copadoManifest = [];
    for (let index = 0; index < data.length; index++) {
      const line = data[index];
      const [mdType, ...rest] = line.split('.');
      const mdname = rest.join('.');
      AppUtils.log1(mdType + ' - ' + mdname);
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
    return copadoManifest;
  }


  
}
