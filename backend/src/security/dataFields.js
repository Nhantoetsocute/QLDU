// Explicit database field mapping: identifiers and accounting values remain searchable;
// contact/name/free-text values use authenticated encryption bound to their record.
const definitions = Object.freeze({
    Users: { id: 'UserId', fields: ['UserName', 'Email', 'Phone', 'Address'] },
    Orders: { id: 'OrderId', fields: ['ReceiverName', 'ReceiverPhone', 'DeliveryAddress', 'Note'] },
    DeliveryAddresses: { id: 'AddressId', fields: ['ReceiverName', 'Phone', 'AddressLine'] },
    Notifications: { id: 'NotificationId', fields: ['Title', 'Body'] },
});
function createDataFields(vault) {
    function context(table, recordId, column) {
        const spec=definitions[table];
        if (!spec || !spec.fields.includes(column) || !/^[1-9]\d*$/.test(String(recordId))) throw new Error('Invalid encrypted field context.');
        return `${table}:${recordId}:${column}`;
    }
    function sealField(table,recordId,column,value) {
        if (value === null || value === undefined) return value;
        if (typeof value !== 'string') throw new Error('Encrypted contact fields require strings.');
        return vault.seal(value,context(table,recordId,column));
    }
    function openField(table,recordId,column,value,{allowPlaintext=false}={}) {
        if (value === null || value === undefined) return value;
        const aad=context(table,recordId,column);
        if (typeof value !== 'string') throw new Error('Invalid encrypted field value.');
        if (!vault.isEncrypted(value)) {
            if (allowPlaintext) return value;
            const error=new Error('Storage migration is required.');error.code='STORAGE_PLAINTEXT';throw error;
        }
        return vault.open(value,aad);
    }
    function revealRow(table,row,options) {
        if (!row) return row;
        const spec=definitions[table];if(!spec) throw new Error('Unknown encrypted table.');
        const output={...row};
        for(const column of spec.fields) if(Object.hasOwn(row,column)) output[column]=openField(table,row[spec.id],column,row[column],options);
        return output;
    }
    function protectRow(table,row,{allowPlaintext=false}={}) {
        const spec=definitions[table];if(!spec) throw new Error('Unknown encrypted table.');
        const output={...row};
        for(const column of spec.fields) if(Object.hasOwn(row,column)) {
            if (row[column] == null) continue;
            const value=openField(table,row[spec.id],column,row[column],{allowPlaintext});
            output[column]=vault.isEncrypted(row[column]) ? row[column] : sealField(table,row[spec.id],column,value);
        }
        return output;
    }
    function userLookups(row) {
        const result={};
        if(Object.hasOwn(row,'Email')) {
            if(typeof row.Email!=='string' || !row.Email.trim()) throw new Error('Email lookup requires a nonempty string.');
            result.EmailLookup=vault.blindIndex(row.Email.trim().toLowerCase(),'Users.Email');
        }
        if(Object.hasOwn(row,'Phone')) result.PhoneLookup=row.Phone == null || row.Phone === '' ? null : vault.blindIndex(String(row.Phone).trim(),'Users.Phone');
        return result;
    }
    return {sealField,openField,revealRow,protectRow,userLookups};
}
function active() { return createDataFields(require('./cryptoVault')); }
module.exports={definitions,createDataFields};
for(const name of ['sealField','openField','revealRow','protectRow','userLookups']) module.exports[name]=(...args)=>active()[name](...args);
