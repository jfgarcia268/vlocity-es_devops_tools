import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const yaml = require('js-yaml');
const fsExtra = require("fs-extra");

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'objects');

export default class cleanObjects extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:objects -u myOrg@example.com -p ins -d objects.yaml
  `,
  `$ sfdx vlocityestools:clean:objects --targetusername myOrg@example.com --dataFile objects.yaml
  `
  ];

  public static args = [{name: 'file'}];

  private static bulkApiPollTimeout = 60;

  private static error = false;

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    datafile: flags.string({char: 'd', description: messages.getMessage('dataFile')}),
    onlyquery: flags.boolean({char: 'q', description: messages.getMessage('onlyquery')}),
    retry: flags.boolean({char: 'r', description: messages.getMessage('retry')}),
    save: flags.boolean({char: 's', description: messages.getMessage('save')}),
    hard: flags.boolean({char: 'h', description: messages.getMessage('hard')}),
    polltimeout: flags.string({char: 't', description: messages.getMessage('polltimeout')}),
    big: flags.boolean({char: 'b', description: messages.getMessage('big')}),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var packageType = this.flags.package;
    var onlyquery = this.flags.onlyquery;
    var retry = this.flags.retry;
    var save = this.flags.save;
    var hard = this.flags.hard;
    var polltimeout = this.flags.polltimeout;
    var big = this.flags.big;

    if(polltimeout){
      cleanObjects.bulkApiPollTimeout = polltimeout;
    }

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    const conn = this.org.getConnection();
    var nameSpaceSet = await AppUtils.setNameSpace(conn,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    }
    //console.log('onlyquery: ' + onlyquery);
    
    var dataFile = this.flags.datafile;

    if (!fsExtra.existsSync(dataFile)) {
      throw new Error("Error: File: " + dataFile + " does not exist");
    }

    var doc = yaml.safeLoad(fsExtra.readFileSync(dataFile, 'utf8'));

    var resultData = [];

    do {
      AppUtils.log4('Deleting....');
      console.log('');
      for (let index = 0; index < Object.keys(doc.Objects).length; index++) {
        var element = Object.keys(doc.Objects)[index];
        var where = doc.Objects[element] != null? doc.Objects[element] : undefined;
        var objectAPIName = AppUtils.replaceaNameSpaceFromFile(element);
        AppUtils.log4('Object: ' + objectAPIName);
        try {
          await this.deleteRecordsFromObject(objectAPIName,conn,onlyquery,where,save,hard,resultData,big);
        } catch (error) {
          AppUtils.log2('Error Deleting: '  + objectAPIName + '  Error: ' + error);
        }
      }
      console.log('');
    } while (retry && cleanObjects.error);

    var tableColumnData = ['ObjectName', 'RecordsFound', 'DeleteSuccess','RecordsSuccess','RecordsFail']; 
    AppUtils.ux.log('RESULTS:');
    //AppUtils.ux.log(' ');
    AppUtils.ux.table(resultData, tableColumnData);
    AppUtils.ux.log(' ');
  }

   async deleteRecordsFromObject(objectName,conn,onlyquery,where,save,hard,resultData,big) {
    var query = 'SELECT Id FROM ' + objectName 
    if(where){
      query += ' ' + where;  
    }
    if (big){
      query += ' LIMIT 500000';
    } 
    AppUtils.log3('Query: ' + query);
    var records = await DBUtils.bulkAPIquery(conn,query);
    if(records.length < 2000 && records.length > 1 && !onlyquery && !hard ){
      AppUtils.log3('Not using Bulk API for less than 2000 records');
      await DBUtils.delete(records,conn,objectName,resultData);
    } else if(!big){
      if(records.length > 1 && !onlyquery){
        //console.log(JSON.stringify(records));
        await DBUtils.bulkAPIdelete(records,conn,objectName,save,hard,resultData,cleanObjects.bulkApiPollTimeout);
      } else {
        resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'N/A'});
      }
    } else {
      AppUtils.log3('Big size...');
      while(records.length > 1 && !onlyquery){
        await DBUtils.bulkAPIdelete(records,conn,objectName,save,hard,resultData,cleanObjects.bulkApiPollTimeout);
        records = await DBUtils.bulkAPIquery(conn,query);
      }
    }
    
  }
  
}
