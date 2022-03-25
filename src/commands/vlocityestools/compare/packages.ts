import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'packagecompare');

const path = require('path');
const dircompare = require('dir-compare');
const fs = require('fs');

export default class compareFolders extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:compare:packages -s vlocity1 -t vlocity2
  `,
  `$ sfdx vlocityestools:compare:packages --folder1 vlocity1 --folder2 vlocity2
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    folder1: flags.string({char: 's', description: messages.getMessage('folder1'), required: true}),
    folder2: flags.string({char: 't', description: messages.getMessage('folder2'), required: true})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {
    AppUtils.logInitial(messages.getMessage('command')); 
    AppUtils.ux = this.ux;

    var foldera = this.flags.folder1;
    var folderb = this.flags.folder2;

    if (!fs.existsSync(foldera)) {
      throw new Error("Folder '" + foldera + "'  not found");
    }

    if (!fs.existsSync(folderb)) {
      throw new Error("Folder '" + folderb + "' not found");
    }
    
    var resultData = [];

    try {
      this.compareFolders(fs,foldera,folderb,resultData);
    } catch (error) {
      console.log(error.stack);
    }
    

    if(resultData.length > 0){
      var tableColumnData = ['DatapackType','DatapackKey','Diff']; 
      AppUtils.ux.log(' ');
      AppUtils.ux.log('OVERLAP RESULTS:');
      AppUtils.ux.log(' ');
      AppUtils.ux.table(resultData, tableColumnData);
      AppUtils.ux.log(' ');

      throw new SfdxError("Overlap was Found - Number of common components: " + resultData.length );
    }
    else {
      AppUtils.log3('Success - No Overlap between ' + foldera + ' and ' + folderb); 
    }

  }

  public compareFolders(fs,foldera,folderb,resultData) {
    AppUtils.log3('Finding Overlap between ' + foldera + ' and ' + folderb); 
    var firstLevelFoler = fs.readdirSync(foldera); 
    for (let index = 0; index < firstLevelFoler.length; index++) {
      const folder1 = firstLevelFoler[index];
      var secondLevelFolerPath = foldera + path.sep + folder1;
      var stats1 = fs.lstatSync(secondLevelFolerPath);
      if(stats1.isDirectory()){
        var secondLevelFoler = fs.readdirSync(secondLevelFolerPath); 
        AppUtils.log2('Finding Overlap For: ' + folder1); 
        for (let indexb = 0; indexb < secondLevelFoler.length; indexb++) {
          const folders2 = secondLevelFoler[indexb];
          var pathLevel2_foldera = foldera + path.sep + folder1 + path.sep + folders2
          //console.log('pathLevel2_foldera: ' + pathLevel2_foldera);
          var pathLevel2_folderb = folderb + path.sep + folder1 + path.sep + folders2
          //console.log('pathLevel2_folderb: ' + pathLevel2_folderb);
          if (fs.lstatSync(pathLevel2_foldera).isDirectory() && fs.existsSync(pathLevel2_folderb) ){
            AppUtils.log1('Overlap - Key: ' + DPKey); 
            var options = {compareContent: true};
            var res = dircompare.compareSync(pathLevel2_foldera, pathLevel2_folderb,options);
            //console.log(res.same);
            var diff = res.same? 'No' : 'Yes';
            var DPKey = folder1 + '/' + folders2;
            resultData.push({DatapackType: folder1, DatapackKey: DPKey, Diff: diff});
          }
        }
      }
    }
  }
  
}
