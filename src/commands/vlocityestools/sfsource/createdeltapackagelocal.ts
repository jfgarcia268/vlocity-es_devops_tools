import { flags, SfdxCommand } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import { AppUtils } from "../../../utils/AppUtils";
import createdeltapackage from "./createdeltapackage";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("vlocityestools", "deltapackagelocal");

export default class deltaPackageLocal extends SfdxCommand {

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx vlocityestools:sfsource:createdeltapackagelocal -h f2a6eee1b509c3edd33ab070148be48e41242846 -d force-app
  `,
    `$ sfdx vlocityestools:sfsource:createdeltapackagelocal --hash f2a6eee1b509c3edd33ab070148be48e41242846 --sourcefolder salesforce_sfdx
  `
  ];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    sourcefolder: flags.string({ char: "d", description: messages.getMessage("sourcefolder")}),
    hash: flags.string({ char: "h", description: messages.getMessage("hash")})
  };

  protected static requiresUsername = false;

  public async run() {
    const fsExtra = require("fs-extra");
    const path = require('path');

    AppUtils.logInitial(messages.getMessage("command"));

    var hash = this.flags.hash;
    var sourceFolder = this.flags.sourcefolder;
    var deltaPackageFolder = sourceFolder + '_delta';

    const repoPath = path.normalize("./");
    const simpleGit = require("simple-git")(repoPath);

    var previousHash = hash;
    AppUtils.log2("Hash: " + previousHash);
    if (fsExtra.existsSync(deltaPackageFolder)) {
      AppUtils.log2("Old delta folder was found... deleting before creating new delta: " + deltaPackageFolder );
      fsExtra.removeSync(deltaPackageFolder);
    }
    createdeltapackage.doDelta(simpleGit, sourceFolder, deltaPackageFolder, fsExtra, previousHash,path);  
  } 
}
