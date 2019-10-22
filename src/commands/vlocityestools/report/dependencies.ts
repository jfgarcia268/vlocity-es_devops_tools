import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'reportdependencies');

export default class dependencies extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:report:dependencies -f vlocity
  `,
  `$ sfdx vlocityestools:report:dependencies --folder vlocity
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    folder: flags.string({char: 'f', description: messages.getMessage('folder')}),
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

    var folder = this.flags.folder;


    if (!fs.existsSync(folder)) {
      throw new Error("Folder '" + folder+ "' not found");
    }

    var resultsFile = './Compare_' + folder +  '.csv';

    AppUtils.log2('Results File: ' + resultsFile ); 

    if (fs.existsSync(resultsFile)) {
      fs.unlinkSync(resultsFile);
    }
    const CreateFiles = fs.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'DataPack Name,Is Reusable,Dependency,Dependency Type,Remote Class,Remote Method';
    CreateFiles.write(initialHeader+'\r\n');   

    ////////// OmniScritp Dependencies
    this.OmniScriptVIPDependencies(fs,CreateFiles,folder,'OmniScript');
    ////////// VIP Dependencies
    this.OmniScriptVIPDependencies(fs,CreateFiles,folder,'IntegrationProcedure');

  }

  public OmniScriptVIPDependencies(fs,CreateFiles,folder,dataPackType) {
    AppUtils.log3('Finding Dependencies for ' + dataPackType + ' in ' + folder); 
    var dataTypePacksFolder = folder + '/' + dataPackType
    var folders = fs.readdirSync(dataTypePacksFolder);
    folders.forEach(dataPack => {
      AppUtils.log2('Finding Dependencies for ' + dataPackType + ': ' + dataPack); 
      var dataPacksFolder = folder + '/' + dataPackType + '/' + dataPack
      var files = fs.readdirSync(dataPacksFolder)
      var dataPackMainFile = folder + '/' + dataPackType + '/' + dataPack + '/' + dataPack + '_DataPack.json';
      var jsonString = fs.readFileSync(dataPackMainFile, 'utf8');
      var jsonStringObjects = JSON.parse(jsonString);
      var isReusable = jsonStringObjects['%vlocity_namespace%__IsReusable__c'];
      files.forEach(file => {
        //AppUtils.log3('File ' + file); 
        var filePath = folder + '/' + dataPackType + '/' + dataPack + '/' + file
        if(file.includes("_Element_")){
          var jsonString = fs.readFileSync(filePath)
          var jsonStringObjects = JSON.parse(jsonString);

          var bundle = jsonStringObjects['%vlocity_namespace%__PropertySet__c'].bundle
          if(bundle != undefined && bundle != ''){
            //console.log('bundle: ' + bundle);
            var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',DataRaptor/' +  bundle + ',DataRaptor,None,None';
            CreateFiles.write(dependencyRecord+'\r\n');   
          }

          var type = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].Type;
          var subType = jsonStringObjects["%vlocity_namespace%__PropertySet__c"]["Sub Type"];
          var language = jsonStringObjects['%vlocity_namespace%__PropertySet__c'].Language;
          var omniScriptcompleteName = type + '_' + subType + '_' + language;
          if(type != undefined && type != ''){
            //console.log('completeName: ' + completeName);
            var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',OmniScript/' +  omniScriptcompleteName + ',OmniScript,None,None';
            CreateFiles.write(dependencyRecord+'\r\n');   
          }

          var vipKey = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].integrationProcedureKey
          if(vipKey != undefined && vipKey != ''){
            //console.log('vipKey: ' + vipKey);
            var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',IntegrationProcedure/' +  vipKey + ',IntegrationProcedure,None,None';
            CreateFiles.write(dependencyRecord+'\r\n');   
          }

          var remoteClass = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].remoteClass
          var remoteMethod = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].remoteMethod
          if(remoteClass != undefined && remoteClass != ''){
            //console.log('remoteClass.remoteClass: ' + remoteClass + '.' + remoteMethod);
            var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',' + remoteClass + '.' + remoteMethod + ',REMOTE CALL,' + remoteClass + ',' + remoteMethod;
            CreateFiles.write(dependencyRecord+'\r\n');   
          }

          var templateID = jsonStringObjects['%vlocity_namespace%__PropertySet__c'].HTMLTemplateId
          if(templateID != undefined && templateID != ''){
            //console.log('templateID: ' + templateID);
            var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',VlocityUITemplate/' +  templateID + ',VlocityUITemplate,None,None';
            CreateFiles.write(dependencyRecord+'\r\n');   
          }
        }
      })
    });
  }

}
