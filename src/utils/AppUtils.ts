
export class AppUtils {

    public static appVersion = require('../../package.json').version;

    public static namespace;

    public static replaceaNameSpace(text) {
        //console.log('BEFORE:' + text);
        var res = text.replace(new RegExp('%name-space%', 'g'),this.namespace);
        //console.log('AFTER:' + res);
        return res;
    }

    public static logInitial(command: string) {
        this.log3('Vlocity ES Tools v' + AppUtils.appVersion);
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
