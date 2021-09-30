import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");
const yaml = require('js-yaml');

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'executejobs');

export default class executejobs extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:jobs:executejobs -u myOrg@example.com -j jobs.yaml
  `,
  `$ sfdx vlocityestools:jobs:executejobs --targetusername myOrg@example.com  --jobs jobs.yaml 
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    jobs: flags.string({char: 'j', description: messages.getMessage('jobs')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var jobs = this.flags.jobs;

    const conn = this.org.getConnection();

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    if (!fsExtra.existsSync(jobs)) {
      throw new Error("Error: File: " + jobs + " does not exist");
    }

    var doc = yaml.safeLoad(fsExtra.readFileSync(jobs, 'utf8'));
    var jobsList = doc.jobs;
    for (const job in jobsList) {
      AppUtils.log4("Running Job: " + jobsList[job]);
      var body = { job: jobsList[job] };
      executejobs.callJob(conn,body); 
      var isDone = false;
      while(!isDone){
        AppUtils.log2("Waiting For Job... " + jobsList[job]);
        //console.log("isDone: " + isDone);
        AppUtils.sleep(10);
        isDone = await executejobs.checkStatus(conn);
      }
      AppUtils.log3("Job Done: " + jobsList[job]);
    }
  }

  static async callJob(conn,body){
    await conn.apex.post("/CMTJobsUtil/", body, function(err, res) {
      if (err) { 
        return console.error(err); 
      }
      //console.log("response: ", res);
    });
  }

  static  async checkStatus(conn){
    var isDone = await conn.apex.get("/CMTJobsUtil/", {}, function(err, res) {
      if (err) { 
        return console.error(err); 
      }
      //console.log("res: " + res);
      return res;
    });
    //console.log("isDone: " + isDone);
    return isDone;
  }
  
}
