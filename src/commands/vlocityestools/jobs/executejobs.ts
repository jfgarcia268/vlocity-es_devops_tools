import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

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
  `$ sfdx vlocityestools:jobs:executejobs -u myOrg@example.com -j jobs.yaml -p 20
  `,
  `$ sfdx vlocityestools:jobs:executejobs --targetusername myOrg@example.com  --jobs jobs.yaml --pooltime 20
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    jobs: flags.string({char: 'j', description: messages.getMessage('jobs')}),
    pooltime: flags.integer({char: 'p', description: messages.getMessage('pooltime')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var jobs = this.flags.jobs;
    var pooltime = this.flags.pooltime;

    const conn = this.org.getConnection();

    var poolTimeSec = pooltime? pooltime : 10;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    if (!fsExtra.existsSync(jobs)) {
      throw new Error("Error: File: " + jobs + " does not exist");
    }

    var totalStartTime,totalEndTime, ttimeDiff  
    totalStartTime= new Date();
    var doc = yaml.safeLoad(fsExtra.readFileSync(jobs, 'utf8'));
    var jobsList = doc.jobs;
    for (const job in jobsList) {
      AppUtils.log4("Running Job: " + jobsList[job]);
      var startTime, endTime, timeDiff, seconds;
      startTime = new Date();
      if(jobsList[job].includes('jobdelete:')){
        var objectName = jobsList[job].split(':')[1];
        AppUtils.log3("Delete Job - Object: " + objectName);
        await DBUtils.bulkAPIQueryAndDelete(conn,objectName,false,2);
      } else {
        var body = { job: jobsList[job] };
        executejobs.callJob(conn,body); 
        await AppUtils.sleep(2);
        var isDone = false;
        AppUtils.startSpinner("Job: " + jobsList[job]);
        while(!isDone){
          endTime = new Date();
          timeDiff = endTime - startTime;
          timeDiff /= 1000;
          seconds = Math.round(timeDiff);
          AppUtils.updateSpinnerMessage('Waiting For Job... Time Elapsed : ' + seconds  + ' seconds - Pooling every ' + poolTimeSec + ' seconds.');
          await AppUtils.sleep(poolTimeSec);
          isDone = await executejobs.checkStatus(conn);
        }
        endTime = new Date();
        timeDiff = endTime - startTime;
        timeDiff /= 1000;
        seconds = Math.round(timeDiff);
        AppUtils.stopSpinnerMessage('Job Done in ' + seconds + ' Seconds' );
      }
      AppUtils.log3("Done: " + jobsList[job]);
    }

    totalEndTime = new Date();
    ttimeDiff = totalEndTime - totalStartTime;
    ttimeDiff /= 1000;
    var tseconds = Math.round(ttimeDiff)/60;

    AppUtils.log4("Done Running Jobs in " + tseconds.toFixed(2) + ' Minutes');
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
