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
    } else if(action == "dataTable") {
        var postData = post.dtData;
        var data = {};
        if(result.installed) {
            data = getJson();
            var dt = new DataTable(postData.data, [], data.fieldNames, data.table, data.datasource);
            result.dataTable = dt;
        } 
        
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

/**
 * Parse Data for DataTable
 * @param data  Data from DT client
 * @param settings  Settings from DT client
 * @param field_names   Database Field Names
 * @param table_name    Database Table Name
 * @param ds    Datastore
 */
function DataTable(data, settings, field_names, table_name, ds) {
    var self = this;
    self.data = data;
    self.settings = settings;
    self.field_names = field_names;
    self.table_name = table_name;
    self.ds = ds;
    // Data from client
    self.draw = data.draw;
    self.row = data.start;
    self.rowPerPage = data.length;
    self.columnIndex = data.order[0].column;
    self.columnName = self.field_names[self.columnIndex];
    self.columnSortOrder = data.order[0].dir;
    self.searchValue = data.search.value;

    self.order = "";
    if(self.columnName != undefined && self.columnSortOrder != undefined) {
        self.order = " ORDER BY "+self.columnName+" "+self.columnSortOrder+" ";
    }

    self.addColumns = function() {
        var columns = [];
        for(var i = 0, length = self.field_names.length; i < length; i++) {
            var field = self.field_names[i];
            var push = {};
            push.data = field;
            columns.push(push);
        }

        console.log(JSON.stringify(columns));

        return columns;
    };
    // Temp Data
    self.searchQuery = " ";
    self.totalRecords = 0;
    self.totalRecordsFilter = 0;

    self.search = function() {
        if(self.searchValue != '') {
            self.searchQuery = " AND (";
            for(var i = 0, length = self.field_names.length; i < length; i++) {
                var field = self.field_names[i];
                self.searchQuery += field + " LIKE '%"+self.searchValue+"%' ";

                if(i != length-1) {
                    self.searchQuery += "OR ";
                }
            }
            self.searchQuery += ") ";
        }
    }; 

    /**
     * Get total rows without filtering
     */
    self.getTotalRows = function() {
        var sql = "SELECT COUNT(*) as total FROM "+self.table_name;
        var response = JSON.parse(datasource.select(self.ds, sql));
        var total = parseInt(response[0].total);

        return total;
    };

    /**
     * Get total rows with filtering
     */
    self.getTotalRowsFilter = function() {
        var sql = "SELECT COUNT(*) as total FROM "+self.table_name + " WHERE 1 "+self.searchQuery + " "+self.order + " LIMIT "+self.row+","+self.rowPerPage;
        var response = JSON.parse(datasource.select(self.ds, sql));
        var total = parseInt(response[0].total);

        return total;
    };

    /**
     * Get Records 
     */
    self.getRecords = function() {
        var field_names = self.field_names.join(",");
        
        var sql = "SELECT "+field_names+" FROM "+self.table_name+" WHERE 1 "+self.searchQuery+" "+self.order+" LIMIT "+self.row+","+self.rowPerPage+";";
        console.log(sql);
        var records = JSON.parse(datasource.select(self.ds, sql));
         var result = Object.keys(records).map(function(key) {
            return Object.keys(records[key]).map(i => records[key][i]);
        });
        return result;
    };

    self.getResponse = function() {
        var payload = {};
        
        payload["draw"] = parseInt(self.draw);
        payload["iTotalRecords"] = self.totalRecords;
        payload["iTotalDisplayRecords"] = self.totalRecordsFilter;
        payload["aaData"] = self.records;

        return payload;
    };

    // Sort Search 
    self.search();
    // Update Total Rows
    self.totalRecords = self.getTotalRows();
    // Update Total Filter Rows
    self.totalRecordsFilter = self.getTotalRowsFilter();

    // Get records
    self.records = self.getRecords();
    return self.getResponse();
};

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