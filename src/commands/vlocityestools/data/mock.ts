import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'mock');

export default class upsert extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:data:mock -u myOrg@example.com -o Account -c 10000
  `,
  `$ sfdx vlocityestools:data:mock --targetusername --object count --id 10000
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    object: flags.string({char: 'o', description: messages.getMessage('object')}),
    count: flags.integer({char: 'c', description: messages.getMessage('count')}),
    batch: flags.integer({char: 'b', description: messages.getMessage('batch')}),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var object = this.flags.object;
    var count = this.flags.count;
    var batch = this.flags.batch;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    const conn = this.org.getConnection();
    const batchSize = batch? batch: 100000;

    AppUtils.log4('Creating Mock Records...');

    var numofloops = Math.ceil(count/batchSize);
    var missing = count;
    AppUtils.log4('Number of Local Batches: ' + numofloops);

    for (let index = 0; index < numofloops; index++) {
      var records = [];
      var numForThisBatch = missing > batchSize? batchSize : missing;
      missing = missing - batchSize;
      AppUtils.log3('Batch # ' + (index+1) + ' - ' +  numForThisBatch + ' Records');
      for (let index2 = 0; index2 < numForThisBatch; index2++) {
        var mockName = 'Mock' + index2 + "." + index2;
        var element = {"Name" : mockName};
        records.push(element);
      }
      await DBUtils.bulkAPIInsert(records,conn,object);
    }

    AppUtils.log3('Creating Mock Records Finished');
  }
  
}
