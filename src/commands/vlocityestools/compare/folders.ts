import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'foldercompare');

export default class compareFolders extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:compare -u myOrg@example.com -n 5
  `,
  `$ sfdx vlocityestools:compare --targetusername myOrg@example.com --numberversions 5
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    folder1: flags.string({char: 's', description: messages.getMessage('folder1')}),
    folder2: flags.string({char: 't', description: messages.getMessage('folder2')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {
    AppUtils.logInitial(messages.getMessage('command')); 

    const fs = require('fs');
    const dircompare = require('dir-compare');

    var foldera = this.flags.folder1;
    var folderb = this.flags.folder2;

    var resultsFile = './Compare_' + foldera + '_' + foldera + '.csv';

    if (fs.existsSync(resultsFile)) {
      fs.unlinkSync(resultsFile);
    }
    const CreateFiles = fs.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'VLOCITY_KEY,COMP_TYPE,COMP_NAME,' + foldera + ',' + folderb + ',EQUAL';
    CreateFiles.write(initialHeader+'\r\n');   

    ////////// DIFF - A vs B
    fs.readdir(foldera,(err,folders) => {
      folders.forEach(FolderLevel1 => {
        var pathLevel1 = foldera + '/' + FolderLevel1
        //console.log('FolderLevel1: ' + pathLevel1);
        fs.readdir(pathLevel1,(err, components) => {
          components.forEach(component => {
            var pathLevel2_folderA = foldera + '/' + FolderLevel1 + '/' + component
            var pathLevel2_folderB = folderb + '/' + FolderLevel1 + '/' + component
            //console.log('component: ' + pathLevel2_folderB); 
            try {
              if (fs.existsSync(pathLevel2_folderB)) {
                //console.log('YES: ' + pathLevel2_folderB);
                var options = {compareSize: true};
                var res = dircompare.compareSync(pathLevel2_folderA, pathLevel2_folderB,options);
                console.log(res.same);
                var diff = res.same;
                var foundResult = FolderLevel1 + '/' + component + ',' + FolderLevel1 + ',' + component + ',Yes,Yes,' + diff;
                CreateFiles.write(foundResult+'\r\n');   
              }
              else {
                //console.log('NO: ' + pathLevel2_folderB);
                //VLOCITY_KEY,COMP_TYPE,COMP_NAME,INPUT1,INPUT2,DIFF
                var notFoundResult = FolderLevel1 + '/' + component + ',' + FolderLevel1 + ',' + component + ',Yes,No,N/A';
                CreateFiles.write(notFoundResult+'\r\n');   
              }
            } catch(err) {
              console.error('err: ' + err);
            }

          })
        })
      });
    })

    ////////// B vs A
    fs.readdir(folderb,(err,folders) => {
      folders.forEach(FolderLevel1 => {
        var pathLevel1 = folderb + '/' + FolderLevel1
        //console.log('FolderLevel1: ' + pathLevel1);
        fs.readdir(pathLevel1,(err, components) => {
          components.forEach(component => {
            var pathLevel2_folderA = foldera + '/' + FolderLevel1 + '/' + component
            //console.log('component: ' + pathLevel2_folderB); 
            try {
              if (!fs.existsSync(pathLevel2_folderA)) {
                //console.log('NO: ' + pathLevel2_folderB);
                //VLOCITY_KEY,COMP_TYPE,COMP_NAME,INPUT1,INPUT2,DIFF
                var notFoundResult = FolderLevel1 + '/' + component + ',' + FolderLevel1 + ',' + component + ',No,Yes,N/A';
                CreateFiles.write(notFoundResult+'\r\n');   
              }
            } catch(err) {
              console.error('err: ' + err);
            }
          })
        })
      });
    })

   //END public async run()
  }
}
