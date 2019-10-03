import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
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

    if (!fs.existsSync(foldera)) {
      throw new Error("Folder '" + foldera + "' does Not exist");
    }

    if (!fs.existsSync(folderb)) {
      throw new Error("Folder '" + folderb + "' does Not exist");
    }

    var resultsFile = './Compare_' + foldera + '_' + folderb + '.csv';

    AppUtils.log2('Results File: ' + resultsFile ); 

    if (fs.existsSync(resultsFile)) {
      fs.unlinkSync(resultsFile);
    }
    const CreateFiles = fs.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'VLOCITY_KEY,COMP_TYPE,COMP_NAME,' + foldera + ',' + folderb + ',EQUAL';
    CreateFiles.write(initialHeader+'\r\n');   

    ////////// DIFF - A vs B
    this.compareFolders(fs,dircompare,CreateFiles,foldera,folderb,true);
    ////////// B vs A
    this.compareFolders(fs,dircompare,CreateFiles,folderb,foldera,false);

  }

  public async compareFolders(fs,dircompare,CreateFiles,foldera,folderb,withDiffs) {
    fs.readdir(foldera,(err,folders) => {
      AppUtils.log2('Finding Differences between ' + foldera + ' and ' + folderb + ' And Orphan Components in ' + foldera); 
      folders.forEach(FolderLevel1 => {
        var pathLevel1 = foldera + '/' + FolderLevel1
        if(!FolderLevel1.startsWith(".") && fs.lstatSync(pathLevel1).isDirectory()){ 
          AppUtils.log1('Comparing: ' + FolderLevel1); 
          //console.log('FolderLevel1: ' + pathLevel1);
          fs.readdir(pathLevel1,(err, components) => {
              //console.log('components:' + components);
              components.forEach(component => {
                var pathLevel2_folderA = foldera + '/' + FolderLevel1 + '/' + component
                if(!component.startsWith(".") && fs.lstatSync(pathLevel2_folderA).isDirectory()){ 
                  var pathLevel2_folderB = folderb + '/' + FolderLevel1 + '/' + component
                  //console.log('component: ' + pathLevel2_folderB); 
                  if (!fs.existsSync(pathLevel2_folderB) && !component.startsWith(".") && fs.lstatSync(pathLevel2_folderA).isDirectory()){
                    //console.log('NO: ' + pathLevel2_folderB);
                    //VLOCITY_KEY,COMP_TYPE,COMP_NAME,INPUT1,INPUT2,DIFF
                    var notFoundResult = FolderLevel1 + '/' + component + ',' + FolderLevel1 + ',' + component + ',Yes,No,N/A';
                    CreateFiles.write(notFoundResult+'\r\n');   
                  } else if (withDiffs && fs.existsSync(pathLevel2_folderB) && !pathLevel2_folderB.startsWith(".")) {
                    //console.log('YES: ' + pathLevel2_folderB);
                    var options = {compareSize: true};
                    var res = dircompare.compareSync(pathLevel2_folderA, pathLevel2_folderB,options);
                    //console.log(res.same);
                    var diff = res.same;
                    var foundResult = FolderLevel1 + '/' + component + ',' + FolderLevel1 + ',' + component + ',Yes,Yes,' + diff;
                    CreateFiles.write(foundResult+'\r\n');   
                  }
                }
              })
          })
        }
      });
    })



  }

}
