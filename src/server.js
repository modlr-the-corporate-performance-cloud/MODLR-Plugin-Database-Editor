//Server side pages allow you to develop restful JSON callables using Javascript.
//The script executes within the MODLR instance providing access to the full MODLR Library of functions.
var sql = null;
var ds = 'Internal Datastore';
var plugin_id = "database_manager";

function request(post) {
    var sql = '';
    var result = {
        "success": true
    };

    var action = post.action;

    // Check if installed

    var isInstalled = script.variableGet(plugin_id+"_installed");
    if(isInstalled == "" || isInstalled == null || isInstalled == undefined) {
        result.installed = false;
    } else {
        result.installed = true;
    }
    
    if(action == "getTable") {
        var table_name = post.table_name;
        sql = "SHOW COLUMNS FROM "+table_name+";";
        result.tableFields = sortTable(JSON.parse(datasource.select(ds, sql)));
        result.table_name = table_name;
    } else if(action == "saveTable") {
        var json = post.table_data;
        var table_name = post.table_name;

        script.variableSet(plugin_id+"_table", json);
        script.variableSet(plugin_id+"_installed", "true");
        result.reload = true;
        result.installed = true;
    } else if(action == "getTables") {
        sql = "SHOW TABLES;";
        result.tables = sortTables(JSON.parse(datasource.select(ds, sql)));
    } else if(action == "getData") {
        var sort = post.sort;
        var data = {};
        if(result.installed) {
            data = getJson();
            var sql = "SELECT "+data.fieldNames.join(',')+" FROM " + data.table;

            var response = JSON.parse(datasource.select(data.datasource, sql));
            data.response = response;
        } 

        result.data = data;
    } else if(action == "saveField") {
        if(result.installed) {
            var data = getJson();
            var field_name = post.field;
            var field = getField(data.displayFields, field_name);
            if(field != null) {
                var pk = post.pk;
                var value = post.value;
                
                sql = "UPDATE "+data.table+" SET "+script.escape(field_name)+" = ? WHERE "+script.escape(data.primaryKey)+" = ?;";
                console.log("Update SQL: " + sql);
                var response = datasource.update(data.datasource, sql, [
                    script.escape(value),
                    parseInt(pk)
                ]);
            }

        }
    }
    

    return JSON.stringify(result);
}

function getField(fields, field_name) {
    for(var i = 0, length = fields.length; i < length; i++) {
        var field = fields[i];
        if(field.name == field_name) {
            return field;
        }
    }
    return null;
}

function getJson() {
    var data = {};
    var tableData = JSON.parse(script.variableGet(plugin_id+"_table"));
            
    data.fieldNames = getFieldNamesFromData(tableData);
    data.displayFields = getFieldsFromData(tableData);
    data.primaryKey = tableData.primaryKey;
    data.table = tableData.table;
    data.datasource = tableData.datasource;

    return data;
}

function getFieldNamesFromData(data) {
    var arr = [];
    for(var i = 0, length = data.fields.length; i < length; i++) {
        var field = data.fields[i];
        arr.push(field.name);
    }

    return arr;
}

function getFieldsFromData(data) {
    var arr = [];
    for(var i = 0, length = data.fields.length; i < length; i++) {
        var field = data.fields[i];
        if(!field.hidden) {
            arr.push(field);
            
        } 
    }

    return arr;
}

function sortTables(tables) {
    var arr = [];
    for(var i = 0, length = tables.length; i < length; i++) {
        var table = tables[i];
        var name = table.tables_in_datastore;

        var push = {};
        push.name = name;
        arr.push(push);
    }

    return arr;
}

function sortTable(fields) {
    var arr = [];
    for(var i = 0, length = fields.length; i < length; i++) {
        var table = fields[i];
        var push = {};
        push.name = table.field;
        push.primaryKey = (table.key == '' ? false : true);
        push.type = "text";
        push.options = [];
        push.hidden = false;
        push.editable = false;

        arr.push(push);
    }

    return arr;
}