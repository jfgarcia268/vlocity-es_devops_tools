import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'upsert');

export default class upsert extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:data:upsert -u myOrg@example.com -p ins -d objects.yaml
  `,
  `$ sfdx vlocityestools:data:upsert --targetusername myOrg@example.com --dataFile objects.yaml
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    csv: flags.string({char: 'f', description: messages.getMessage('csv')}),
    object: flags.string({char: 'o', description: messages.getMessage('object')}),
    id: flags.string({char: 'i', description: messages.getMessage('id')}),
    save: flags.boolean({char: 's', description: messages.getMessage('save')}),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var object = this.flags.object;
    var id = this.flags.id;
    var save = this.flags.save;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    const conn = this.org.getConnection();
    
    var dataFile = this.flags.csv;

    if (!fsExtra.existsSync(dataFile)) {
      throw new Error("Error: File: " + dataFile + " does not exist");
    }

    if (!object) {
      throw new Error("Object API Name is needed");
    }

    if (!id) {
      throw new Error("Object API Name is needed");
    }
    
    var doc = fsExtra.readFileSync(dataFile, 'utf8');
    
    AppUtils.log3('Reading Records...');
    var dataToUpsert = await DBUtils.csvToJson(doc);
    AppUtils.log3( dataToUpsert.length + ' Records Found');

    await DBUtils.bulkAPIUpsert(dataToUpsert,conn,object,id,save);

    AppUtils.log3('Upsert Finished');
  }
  
}
