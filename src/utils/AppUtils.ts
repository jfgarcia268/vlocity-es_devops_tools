
export class AppUtils {

    public static appVersion = require('../../package.json').version;

    public static logInitial(command: string) {
        this.log3('Vlocity Tools v' + AppUtils.appVersion);
        this.log3('Command: ' + command);
    }  

    public static log3(message) {
        console.log('>>> ' + message);
    }

    public static log2(message) {
        console.log('>> ' + message);
    }

    public static log1(message) {
        console.log('> ' + message);
    }

}
