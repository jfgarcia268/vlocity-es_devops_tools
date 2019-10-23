import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'reportdependencies');

var dependenciesFound = 0;

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
    dependenciesFound = 0;
    const fs = require('fs');

    var folder = this.flags.folder;


    if (!fs.existsSync(folder)) {
      throw new Error("Folder '" + folder+ "' not found");
    }

    var resultsFile = './Dependencies_Report.csv';

    AppUtils.log2('Results File: ' + resultsFile ); 

    if (fs.existsSync(resultsFile)) {
      fs.unlinkSync(resultsFile);
    }


    const CreateFiles = fs.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'DataPack Name,Is Reusable,Dependency,Dependency Type,Remote Class,Remote Method';
    CreateFiles.write(initialHeader+'\r\n');   

    ////////// OmniScritp Dependencies
    var numberOfOmniScriptFound = 0;
    var OmniScriptsFolder = folder +  '/OmniScript';
    if(fs.existsSync(OmniScriptsFolder)){
      var files = fs.readdirSync(OmniScriptsFolder).filter(function (file) {
        return fs.statSync(OmniScriptsFolder+'/'+file).isDirectory();
      });

      var numberOfOmniScriptFolder = files.length;

      if(numberOfOmniScriptFolder > 1){
        var numberOfOmniScriptFound = this.OmniScriptVIPDependencies(fs,CreateFiles,folder,'OmniScript');
      }
      else{
        AppUtils.log3('No OmniScripts found in Folder: ' + folder + '/OmniScript'); 
      }
    }
    else {
      AppUtils.log3('No OmniScript Folder found in: ' + folder); 
    }
  
    ////////// VIP Dependencies
    var numberOfIntegrationProceduretFound = 0;
    var IntegrationProcedureFolder = folder +  '/IntegrationProcedure';


    if(fs.existsSync(IntegrationProcedureFolder)){
      var files = fs.readdirSync(IntegrationProcedureFolder).filter(function (file) {
        return fs.statSync(IntegrationProcedureFolder+'/'+file).isDirectory();
      });
      var numberVIPFolder = files.length;
      if(numberVIPFolder > 1){
        var numberOfIntegrationProceduretFound = this.OmniScriptVIPDependencies(fs,CreateFiles,folder,'IntegrationProcedure');
      }
      else{
        AppUtils.log3('No IntegrationProcedures found in Folder: ' + folder + '/OmniScript'); 
      }
    }
    else {
      AppUtils.log3('No IntegrationProcedures Folder found in: ' + folder); 
    }

    ////////// Report
    console.log('')
    AppUtils.log3('Donde Finding Dependencies'); 
    AppUtils.log3('Number of OmniScripts Scanned: ' + numberOfOmniScriptFound); 
    AppUtils.log3('Number of IntegrationProcedures Scanned: ' + numberOfIntegrationProceduretFound); 
    AppUtils.log3('Number of Total Dependencies Found: ' + dependenciesFound); 
    AppUtils.log3('CSV File Generated: ' + resultsFile); 
    console.log('')
  }


  public OmniScriptVIPDependencies(fs,CreateFiles,folder,dataPackType) {
    console.log('')
    AppUtils.log3('Finding Dependencies for ' + dataPackType + ' in ' + folder); 
    var dataTypePacksFolder = folder + '/' + dataPackType
    var folders = fs.readdirSync(dataTypePacksFolder);
    var numberOfDPFound = 0;
    folders.forEach(dataPack => {
      var dataPacksFolder = folder + '/' + dataPackType + '/' + dataPack
      if((fs.statSync(dataPacksFolder)).isDirectory()){
        AppUtils.log2('Finding Dependencies for ' + dataPackType + ': ' + dataPack); 
        var files = fs.readdirSync(dataPacksFolder)
        var dataPackMainFile = folder + '/' + dataPackType + '/' + dataPack + '/' + dataPack + '_DataPack.json';
        if(fs.existsSync(dataPackMainFile)){
          numberOfDPFound = numberOfDPFound + 1;
          var jsonString = fs.readFileSync(dataPackMainFile, 'utf8');
          var jsonStringObjects = JSON.parse(jsonString);
          var isReusable = jsonStringObjects['%vlocity_namespace%__IsReusable__c'];
          files.forEach(file => {
            //AppUtils.log3('File ' + file); 
            var filePath = folder + '/' + dataPackType + '/' + dataPack + '/' + file
            if((fs.statSync(filePath)).isFile() && file.includes("_Element_")){
              var jsonString = fs.readFileSync(filePath)
              var jsonStringObjects = JSON.parse(jsonString);

              var bundle = jsonStringObjects['%vlocity_namespace%__PropertySet__c'].bundle
              if(bundle != undefined && bundle != ''){
                //console.log('bundle: ' + bundle);
                var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',DataRaptor/' +  bundle + ',DataRaptor,None,None';
                CreateFiles.write(dependencyRecord+'\r\n');   
                dependenciesFound = dependenciesFound + 1;
              }

              var type = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].Type;
              var subType = jsonStringObjects["%vlocity_namespace%__PropertySet__c"]["Sub Type"];
              var language = jsonStringObjects['%vlocity_namespace%__PropertySet__c'].Language;
              var omniScriptcompleteName = type + '_' + subType + '_' + language;
              if(type != undefined && type != ''){
                //console.log('completeName: ' + completeName);
                var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',OmniScript/' +  omniScriptcompleteName + ',OmniScript,None,None';
                CreateFiles.write(dependencyRecord+'\r\n');   
                dependenciesFound = dependenciesFound + 1;
              }

              var vipKey = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].integrationProcedureKey
              if(vipKey != undefined && vipKey != ''){
                //console.log('vipKey: ' + vipKey);
                var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',IntegrationProcedure/' +  vipKey + ',IntegrationProcedure,None,None';
                CreateFiles.write(dependencyRecord+'\r\n'); 
                dependenciesFound = dependenciesFound + 1;  
              }

              var remoteClass = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].remoteClass
              var remoteMethod = jsonStringObjects["%vlocity_namespace%__PropertySet__c"].remoteMethod
              if(remoteClass != undefined && remoteClass != ''){
                //console.log('remoteClass.remoteClass: ' + remoteClass + '.' + remoteMethod);
                var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',' + remoteClass + '.' + remoteMethod + ',REMOTE CALL,' + remoteClass + ',' + remoteMethod;
                CreateFiles.write(dependencyRecord+'\r\n');   
                dependenciesFound = dependenciesFound + 1;
              }

              var templateID = jsonStringObjects['%vlocity_namespace%__PropertySet__c'].HTMLTemplateId
              if(templateID != undefined && templateID != ''){
                //console.log('templateID: ' + templateID);
                var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',VlocityUITemplate/' +  templateID + ',VlocityUITemplate,None,None';
                CreateFiles.write(dependencyRecord+'\r\n');  
                dependenciesFound = dependenciesFound + 1; 
              }
            }
          })
        }
      }
    });
    AppUtils.log3('Done finding Dependencies for ' + dataPackType + ' in ' + folder); 
    return numberOfDPFound;
  }

}
