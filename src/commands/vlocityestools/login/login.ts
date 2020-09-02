import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, AuthInfo, Aliases, ConfigGroup } from '@salesforce/core';
import { getString } from "@salesforce/ts-types";
import { AppUtils } from '../../../utils/AppUtils';
import { Connection } from 'jsforce';
 
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'login');


export default class login extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:login:login -u jgonzalez@vlocity.com.de1 -p 'pass123' -t eXUTfa9gpIxfaytnONqnlWFG -a dev1
  `,
  `$ sfdx vlocityestools:login:login --username jgonzalez@vlocity.com.de1 --password 'pass123' --token eXUTfa9gpIxfaytnONqnlWFG --url 'https://test.salesforce.com' --alias dev1
  `
  ];

  public static args = [{name: 'file'}];

  public static ux;

  protected static flagsConfig = {
    username: flags.string({char: 'u', description: messages.getMessage('username'), required: true }),
    password: flags.string({char: 'p', description: messages.getMessage('password'), required: true }),
    token: flags.string({char: 't', description: messages.getMessage('token')}),
    url: flags.string({char: 'l', description: messages.getMessage('url')}),
    alias: flags.string({char: 'a', description: messages.getMessage('alias'), required: true })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {
    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command'));

    var username = this.flags.username;
    var password = this.flags.password;
    var token = this.flags.token;
    var url = this.flags.url;
    var alias = this.flags.alias;

    var loingURL = "https://login.salesforce.com";
    var pass = password;

    if (url){
      loingURL = url;
    }

    if (token){
      pass = pass + token;
    }

    AppUtils.log2("Username: " + username);
    AppUtils.log2("Alias: " + alias);
    AppUtils.log2("Url: " + url);

    AppUtils.startSpinner('Contenting To: ' + username);

    let conn = await login.connectToOrg(username,url,pass);

    AppUtils.stopSpinnerMessage('Successfully connected...');
    
    AppUtils.log2("Creating Alias");

    await login.createAlias(conn,username,alias,url);

    console.log("");
    AppUtils.log3("Succesfully created Alias '" + alias + "' for Username: " + username);

  }

  static  async createAlias(conn,username,alias,url){
    const accessTokenOptions = {
      accessToken: conn.accessToken,
      instanceUrl: conn.instanceUrl,
      loginUrl: url,
      orgId: getString(conn, "userInfo.organizationId")
    };

    const auth = await AuthInfo.create({
      username: username,
      accessTokenOptions
    });

    await auth.save();
    const aliases = await Aliases.create( ConfigGroup.getOptions("orgs", "alias.json"));
    aliases.set(alias, username);
    await aliases.write();

  }

  static async connectToOrg(username,url,pass){ 
    let conn = new Connection({
      loginUrl: url
    });
    
    await conn.login(username, pass, function(err,userInfo ) {
      if (err) {
        throw new SfdxError("Error conection to org: " + err );
      }
    });

    return conn;
  }


}
