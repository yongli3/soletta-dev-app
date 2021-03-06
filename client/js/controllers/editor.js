// This file is part of the Soletta Project
//
// Copyright (C) 2015 Intel Corporation. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function() {
    'use strict';
    app.controller ('editor', ['$compile', '$scope', '$http', '$interval',
        '$document', 'broadcastService', 'FetchFileFactory',
        'usSpinnerService', 'svConf',
        function ($compile, $scope, $http, $interval, $document, broadcastService,
                  FetchFileFactory, usSpinnerService, svConf) {
                var isRunningSyntax = false;
                var promiseCheckSyntax;
                var promiseServiceStatus;
                var promiseRunViewer;
                var markId;
                var schemaDiag;
                var filePath;
                var isLeaf;
                var nodenames = [];
                var inports = [], outports = [];
                var members = [], membernodes = [];
                $scope.clearTimeStamp = 0;
                $scope.clipboard = "";
                $scope.syntaxCheckRefreshPeriod = 1100;
                $scope.runConf = false;
                $scope.loginConf = false;
                $scope.runJournal = false;
                $scope.shouldSave = false;
                $scope.runningStartStop = false;
                svConf.fetchConf().success(function(data){
                    $scope.runConf = data.run_fbp_access;
                    $scope.loginConf = data.login_system;
                    $scope.runJournal = data.journal_access;
                    $scope.runDialogRefreshPeriod = parseInt(data.run_dialog_refresh_period);
                    $scope.syntaxCheckRefreshPeriod = parseInt(data.syntax_check_refresh_period);
                    $scope.refreshPeriod = parseInt(data.fbp_service_status_refresh_period);
                    if ($scope.runJournal === true) {
                        $scope.startServiceStatus();
                    }
                });
                $scope.showhideCode = "Hide Code Viewer";
                $scope.showhideFlow = "Hide Flow Viewer";
                $scope.showhideProject = "Hide Project Viewer";
                $scope.libChecked = true;
                $scope.codeChecked = true;
                $scope.svgChecked = true;
                $scope.logged = false;
                $scope.fbpType = true;
                $scope.isServiceRunning = false;
                $scope.isServiceRunningReturn = false;
                $scope.isJournaldReturn = false;
                var editor = ace.edit("fbp_editor");
                var Range = require('ace/range').Range;
                var aceConfig = require("ace/config");
                var modelist = ace.require("ace/ext/modelist");
                var langtools = ace.require("ace/ext/language_tools");
                editor.setOptions({
                    autoScrollEditorIntoView: true,
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true
                });
                editor.commands.removeCommand("showSettingsMenu");
                editor.$blockScrolling = Infinity;
                editor.session.setOption("useWorker", false);
                editor.setFontSize(15);
                editor.setTheme('ace/theme/monokai');
                editor.keyBinding.origOnCommandKey = editor.keyBinding.onCommandKey;

                $scope.fbpType = true;
                aceConfig.set("basePath","js/ace/");
                aceConfig.set("modePath", "js/ace/");
                editor.getSession().setMode("ace/mode/fbp");
                $scope.fileViewer = '# Write FBP Code here.';
                $scope.nodeSelected = function(e, data) {
                    var _l = data.node.li_attr;
                    var repos = _l.id.split("repos")[1];
                    var rfinal = repos.split("/");
                    var previousContent = editor.getSession().getValue();
                    $scope.subFolder = rfinal[1];
                    $scope.folder = rfinal[2];
                    $scope.getConfigurationlist(_l.id);
                    isLeaf = _l.isLeaf;
                    aceConfig.set("modePath", "libs/ace-builds/src-min/");
                    if (_l.isLeaf) {
                        FetchFileFactory.fetchFile(_l.base).then(function(data) {
                            var _d = data.data;
                            if (typeof _d == 'object') {
                                _d = JSON.stringify(_d, undefined, 2);
                            }
                            $scope.setEditorContent(_d, previousContent, filePath);
                            filePath = _l.id;
                            $scope.fileName = ': ' + filePath.split("/").pop(); //getting the selected node name
                            var mode = modelist.getModeForPath(filePath).mode;
                            editor.session.setMode(mode);
                            var type_file = _l.base.slice(-3);
                            if (type_file === "fbp") {
                                $("#svgFrame").empty();
                                $scope.fbpType = true;
                                aceConfig.set("modePath", "js/ace/");
                                editor.getSession().setMode("ace/mode/fbp");
                                showSchema();
                            } else {
                                $scope.schemaOn = false;
                                $scope.fbpType = false;
                            }

                            editor.setHighlightActiveLine(false);
                            editor.setReadOnly(false);
                        });
                        $scope.root = false;
                    } else {
                        editor.getSession().setMode();
                        if (data.node.parent === "#") {
                            $scope.root = true;
                            $scope.setEditorContent('Please select a file to view its contents', previousContent, filePath);
                        } else {
                            if (data.node.parents[1] === "#") {
                                $scope.root = true;
                                $scope.setEditorContent('Please select a file to view its contents', previousContent, filePath);
                            } else {
                                if (!isLeaf) {
                                    $scope.setEditorContent('Please select a file to view its contents', previousContent, filePath);
                                }
                                $scope.root = false;
                            }
                        }
                        filePath = _l.id;
                        $scope.fileName = ': ' + filePath.split("/").pop(); //getting the selected node name
                        $scope.fbpType = false;
                        editor.setReadOnly(true);
                        editor.setHighlightActiveLine(false);
                    }
                };

                function showSchema() {
                    if ($scope.folder === "demo") {
                        var name = $scope.fileName.split(".fbp")[0].split(" ")[1];
                        var schema_name = "schema-" + name + ".jpg";
                        $scope.schema = "imgs/schema/" + schema_name;
                        hasImage($scope.schema,
                            function () {
                                // This function will run when the image is found
                                $scope.schemaOn = true;
                            }, function () {
                                // This function will run when the image is not found
                                $scope.schemaOn = false;
                            });
                    } else {
                        $scope.schemaOn = false;
                    }
                }

                function hasImage(src, loaded, failed) {
                     var img = new Image();
                     img.onerror = failed;
                     img.onload = loaded;
                     img.src = src;
                 }

                function jsTreeTraverse(state, nodes) {
                    var inst = $('#jstree').jstree(true);
                    var node = inst.get_node(state);
                    var type = node.text.split(".").pop();
                    if (type === "json") {
                        nodes.push({id: node.id, text: node.text});
                    }
                    if (inst.is_parent(node)) {
                        $.each(node.children, function(index, child) {
                            jsTreeTraverse(child, nodes);
                        });
                    }
                }

                $scope.showSchema = function () {
                    schemaDiag = $('<div></div>').
                          html($compile('<img style="width:100%;height:100%;" ng-src="{{schema}}"></img>')($scope)).
                          dialog({
                              title: "Schema",
                              autoOpen: false,
                              modal: true,
                              position: { at: "center top"},
                              height: 600,
                              width: '900',
                              show: { effect: "fade", duration: 300 },
                              hide: {effect: "fade", duration: 300 },
                              resize: 'disable',
                              buttons: {
                                Close: function() {
                                    $(this).dialog("close");
                                }
                              },
                              close: function(ev, ui){
                                  $(this).dialog("close");
                              }
                          });
                      schemaDiag.dialog("open");
                };

                $scope.setEditorContent = function (content, previousContent, savePath) {
                    if ($scope.shouldSave === false || !previousContent) {
                        editor.getSession().setValue(content);
                    } else {
                        sure_dialog("Save", "The file was changed. Would you like to save it?",
                            function(close_id) {
                                if(close_id) {
                                    $scope.saveFile(savePath, previousContent);
                                    editor.getSession().setValue(content);
                                    $scope.refreshTree();
                                } else {
                                    editor.getSession().setValue(content);
                                }
                            });
                        $scope.shouldSave = false;
                    }
                };

                $scope.getConfigurationlist = function (repo_id) {
                    if ($scope.folder && $scope.subFolder) {
                        var id = "/";
                        var start_count = false;
                        var count = 0;
                        var array_repo = repo_id.split("/");
                        for (var i = 1; i < array_repo.length; i++) {
                            id = id + array_repo[i];
                            if (start_count) {
                                count++;
                                if(count === 2) {
                                    break;
                                }
                            }
                            id = id + "/";
                            if (array_repo[i] === "repos") {
                                start_count = true;
                            }
                        }

                        $('#configComboBox').empty();
                        $('#configComboBox').append('<option value="none">none</option>');
                        var nodes = [];
                        jsTreeTraverse($('#jstree').jstree(true).get_json(id), nodes);
                        if(nodes.length > 0) {
                            $('#configComboBox').combobox();
                            for (i = 0; i < nodes.length; i++) {
                                $("#configComboBox").append('<option value="'+ nodes[i].id +
                                                      '">'+ nodes[i].text + '</option>');
                            }
                        }
                    }
                };

                $("#configComboBox").combobox({
                    select: function( event, ui ) {
                      $scope.selectConfigPath = ui.item.value;
                      $scope.checkSyntaxStart();
                    }
                });

                $scope.openRunDialog = function() {
                    var dialog = $('<div></div>').html($compile('<table cellpadding="0" cellspacing="0" border="0"' +
                                                                'class="table table-hover data-table sort display"' +
                                                                'style="font-size: 12px !important; background-color:#262a2e;'+ 'color:#afb2b6;">'+
                                                                '<tbody><tr ng-repeat="item in RunViewer' +
                                                                "| orderBy:'__REALTIME_TIMESTAMP':true" + '" >' +
                                                                '<td class="time" style="width: 200px; border:0;"> ' +
                                                                "{{(item.__REALTIME_TIMESTAMP / 1000) | date:'dd-MM-yyyy HH:mm'}}</td>" +
                                                                '<td class="message" style="border:0;" >{{item.MESSAGE}}</td></tr></tbody></table>'
                                                               )($scope)).
                            dialog({
                                title: "Run",
                                autoOpen: false,
                                modal: true,
                                position: { at: "center top"},
                                height: 'auto',
                                width: '75%',
                                show: { effect: "fade", duration: 300 },
                                hide: {effect: "fade", duration: 300 },
                                resizable: 'disable',
                                scrollable: 'disable',
                                buttons: {
                                    Clear: function () {
                                        var len = $scope.RunViewer.length -1;
                                        $scope.clearTimeStamp = $scope.RunViewer[len].__REALTIME_TIMESTAMP;
                                        $scope.RunViewer = [];
                                    },
                                    Close: function() {
                                        $interval.cancel(promiseRunViewer);
                                        $(this).dialog("close");
                                    }
                                },
                                close: function(ev, ui){
                                    $interval.cancel(promiseRunViewer);
                                    $(this).dialog("close");
                                }
                            });
                    $scope.getOutput();
                    dialog.dialog("open");
                    promiseRunViewer = $interval(function () { $scope.getOutput(); }, $scope.runDialogRefreshPeriod);
                };

                $scope.getOutput = function () {
                    if ($scope.isJournaldReturn === false) {
                        $scope.isJournaldReturn = true;
                        $http.get('/api/journald',
                        {
                            params: {
                                "unit_name": "fbp-runner@",
                                }
                        }).success(function(data) {
                            if ($scope.clearTimeStamp === 0) {
                                $scope.RunViewer = data;
                            } else {
                                var array = [];
                                for(var i in data){
                                    if (data[i].__REALTIME_TIMESTAMP > $scope.clearTimeStamp) {
                                        array.push(data[i]);
                                    }
                                }
                                $scope.RunViewer = array;
                            }
                            $scope.isJournaldReturn = false;
                        }).error(function(){
                            $scope.RunViewer = "Erro getting systemd journald";
                            $scope.isJournaldReturn = false;
                        });
                    }
                };

                $scope.run = function() {
                    if (!$scope.runningStartStop) {
                        if ($scope.isServiceRunning) {
                            //Post stop service
                            $scope.runningStartStop = true;
                            $http.post('/api/fbp/stop').success(function(data) {
                                    if (data == 1) {
                                       alert("FBP Service failed to stop");
                                    }
                            }).error(function(){
                                $scope.runningStartStop = false;
                            });
                        } else if ($scope.fbpType === true) {
                            $scope.runningStartStop = true;
                            var fbpCode = editor.getSession().getValue();
                            var fbpName = $scope.fileName;
                            $scope.newFile = true;
                            var conf = $scope.selectConfigPath;
                            if (conf === "none") {
                                conf = null;
                            }
                            if (!filePath) {
                                filePath = "/tmp/cached.fbp";
                            }
                            $http.post('/api/fbp/run',
                                    {params: {
                                        "fbp_name": fbpName,
                                        "fbp_path": filePath,
                                        "code": fbpCode,
                                        "conf": conf
                                    }
                            }).success(function(data) {
                                if (data) {
                                    $scope.openRunDialog();
                                } else {
                                    alert("FBP Failed to run");
                                }
                                $scope.runningStartStop = false;
                            }).error(function(){
                                $scope.openRunDialog();
                                $scope.runningStartStop = false;
                            });
                        }
                    }
                };

                $scope.newFbpFile = function() {
                    $scope.newFile = true;
                };

                $scope.$on('filePath', function () {
                    filePath = broadcastService.message;
                });

                window.onbeforeunload = onBeforeUnload_Handler;
                function onBeforeUnload_Handler() {
                    if ($scope.isServiceRunning) {
                        $http.post('/api/fbp/stop').success(function(data) {
                            if (data == 1) {
                                alert("FBP Service failed to stop. Process should be stopped manually");
                            }
                        });
                    }

                    if ($scope.shouldSave === true) {
                        return "The file was changed and the data was not saved.";
                    } else {
                        return undefined;
                    }

                }

                $scope.checkSyntax = function () {
                    var fbpCode = editor.getSession().getValue();
                    if (fbpCode.trim().length > 1 && $scope.fbpType === true) {
                        var conf = $scope.selectConfigPath;
                        if (conf === "none") {
                            conf = null;
                        }
                        if (!filePath) {
                            filePath = "/tmp/cached.fbp";
                        }
                        $http.get('/api/check/fbp',
                                {params: {
                                             "fbp_path": filePath,
                                             "code": fbpCode,
                                             "conf": conf
                                         }
                                }).success(function(data) {
                                    $scope.FBPSyntax = data.trim();
                                    var errorline = data.match(/.+\.fbp:[0-9]+:[0-9]+/g);
                                    var errorDesc = data.split(/.+\.fbp:[0-9]+:[0-9]+/g);
                                    editor.getSession().removeMarker(markId);
                                    editor.getSession().clearAnnotations();
                                    if (errorline) {
                                        var lines = errorline[0].split(":");
                                        editor.getSession().setAnnotations([{
                                            row: lines[1]-1,
                                            column: lines[2]-1,
                                            text: errorDesc[1].trim(),
                                            type: "error"}]);
                                            var Range = ace.require("ace/range").Range;
                                            markId = editor.getSession().addMarker(
                                                                                  new Range(lines[1]-1, 0,
                                                                                  lines[1]-1, 144),
                                                                                  "errorHighlight",
                                                                                  "fullLine");
                                    } else {
                                        $http.get('/api/gen-svg',
                                            {params: {
                                                        "code": fbpCode
                                                     }
                                            }).success(function(data) {
                                            var themedSvg = data.replace("white", "#202429");
                                            $("#svgFrame").html(themedSvg);
                                        }).error(function(){
                                            console.log("Failed to generate SVG");
                                            $("#svgFrame").html("Failed to generate SVG");
                                        });
                                    }
                                }).error(function(){
                                    $scope.FBPSyntax = data.trim();
                                });
                    } else {
                        $scope.FBPSyntax = "";
                        editor.getSession().removeMarker(markId);
                        editor.getSession().clearAnnotations();
                    }
                    $scope.checkSyntaxStop();
                };

                $scope.checkSyntaxStop = function() {
                    $interval.cancel(promiseCheckSyntax);
                };

                $scope.checkSyntaxStart = function() {
                    $scope.checkSyntaxStop();
                    promiseCheckSyntax = $interval(
                            function () {
                                $scope.checkSyntax();
                            }, $scope.syntaxCheckRefreshPeriod);
                };

                $scope.saveFile = function(path, body) {
                    if (body && path) {
                        $http.get('api/file/write',
                                  {params: {
                                      "file_path": path,
                                      "file_body": body
                                      }
                                  });
                    }
                };

                $scope.saveFileManually = function() {
                      if ($scope.shouldSave) {
                          var file = filePath;
                          var body = editor.getSession().getValue();
                          if (filePath === "/tmp/cached.fbp") {
                            $scope.createProjectFromScratch();
                          } else {
                              if (file && body) {
                                 $http.get('api/file/write',
                                      {params: {
                                              "file_path": file,
                                          "file_body": body
                                      }
                                 }).success(function(data) {
                                    $scope.shouldSave = false;
                                    //pop * from the string
                                    if ($scope.fileName) {
                                            $scope.fileName = $scope.fileName.substring(0, $scope.fileName.length-1);
                                            $scope.refreshTree();
                                    }
                                 }).error(function(){
                                    alert("Failed to save file on server. Try again.");
                                    $scope.shouldSave = true;
                                 });
                              } else {
                                 alert("Something went terrbile wrong.\nFailed to save file on server. Try again.");
                              }
                          }
                      }
                  };

                editor.keyBinding.onCommandKey = function(e, hashId, keyCode) {
                    if ($scope.shouldSave === false && $scope.folder !== "demo") {
                        if ($scope.fileName) {
                            $scope.fileName = $scope.fileName + "*";
                        }
                        $scope.shouldSave = true;
                    }
                    this.origOnCommandKey(e, hashId, keyCode);
                };

                $scope.editorChanged = function (e) {
                    if (isRunningSyntax === false) {
                        isRunningSyntax = true;
                        $scope.checkSyntaxStart();
                        isRunningSyntax = false;
                    }
                };

                function sure_dialog(title, description, callback) {
                    var dialog = $('<div></div>').html(description).
                        dialog({
                            title: title,
                            autoOpen: false,
                            modal: true,
                            position: { at: "center top"},
                            height: 170,
                            width: 412,
                            resizable: 'disable',
                            show: { effect: "fade", duration: 300 },
                            hide: {effect: "fade", duration: 300 },
                            buttons: {
                                Yes: function() {
                                    $(this).dialog("close");
                                    callback(true);
                                },
                                No: function() {
                                    $(this).dialog("close");
                                    callback(false);
                                }
                            },
                            close: function(ev, ui){
                                callback(false);
                                $(this).dialog("close");
                            }
                        });
                    dialog.keypress(function(e) {
                        if (e.keyCode === $.ui.keyCode.ENTER) {
                            callback(true);
                            $(this).dialog("close");
                        }
                    });
                    dialog.dialog("open");

                }

                function isFileExists(repo, file_name) {
                    var tree = $('#jstree').jstree(true);
                    var rep = tree.get_node(repo);
                    var test = false;
                    $.each(rep.children, function (index, file) {
                        var file_test = file.split("/").pop();
                        if (file_name === file_test) {
                            test = true;
                        }
                    });
                    return test;
                }

                function normalizeName(name) {
                    if (name.charAt(0) === '.') {
                        return name.substr(1);
                    } else {
                        return name;
                    }
                }

                function confirmProjectCreation(prj_name, fbp_name, body) {
                    prj_name = normalizeName(prj_name);
                    fbp_name = normalizeName(fbp_name);
                    $http.post('/api/git/repo/create/new/project',
                    {
                        params: {
                            "project_name": prj_name,
                            "file_name": fbp_name,
                            "file_code": body
                        }
                    }).success(function(data) {
                        var repo_data = data;
                        var file_data = data + "/" + fbp_name;
                        var t = $("#jstree").jstree(true);
                        $("#jstree").one("refresh.jstree", function () {
                            $("#jstree").one("open_node.jstree", function () {
                                t.select_node(file_data);
                            });
                            t.open_node(repo_data);
                        });
                        $scope.refreshTree();
                        $scope.shouldSave = false;
                        $(".ui-dialog-buttonpane button:contains('Close')").button("enable");
                        $(".ui-dialog-buttonpane button:contains('Create')").button("enable");
                    }).error(function(data) {
                        alert("Failed to create project aborting. Reason: " + data);
                        $(".ui-dialog-buttonpane button:contains('Close')").button("enable");
                        $(".ui-dialog-buttonpane button:contains('Create')").button("enable");
                    });
                }

                function isProjectExists(project_name) {
                    var test = false;
                    $.each($("#tree li"), function(key, li) {
                       var prj = li.id.split("/").pop();
                       if (project_name === prj) {
                           test = true;
                       }
                    });
                    return test;
                }

                $scope.createProjectFromScratch = function () {
                    var dialog = $('<div></div>').
                                 html($compile('<div>Project name <input class="inputControls"' +
                                               ' type="text" style="width: 256px; outline: 0;"' +
                                               ' ng-model="prj_name" /></div>' +
                                               '<br><div> FBP file name <input class="inputControls"' +
                                               ' type="text" style="width: 256px; outline: 0;"' +
                                               ' ng-model="file_name" /></div>')($scope)).
                    dialog({
                        title: "Create Project",
                        autoOpen: false,
                        modal: true,
                        position: { at: "center top"},
                        height: 270,
                        width: 300,
                        show: { effect: "fade", duration: 300 },
                        hide: {effect: "fade", duration: 300 },
                        resizable: 'disable',
                        closeOnEscape: false,
                        open: function(event, ui) {
                            $(".ui-dialog-titlebar-close").hide();
                            dialog.keyup(function(e) {
                                if (e.keyCode === $.ui.keyCode.ENTER) {
                                    $(".ui-dialog-buttonpane button:contains('Create')").click();
                                }
                            });
                        },
                        buttons: {
                            "Create": function() {
                                if ($scope.prj_name && $scope.file_name) {
                                    $(".ui-dialog-buttonpane button:contains('Close')").button("disable");
                                    $(".ui-dialog-buttonpane button:contains('Create')").button("disable");
                                    var body;
                                    if (filePath) {
                                        body = editor.getSession().getValue();
                                    }
                                    var fbp_name = $scope.file_name;
                                    if (fbp_name.substr(fbp_name.length - 4) !== ".fbp") {
                                        fbp_name = fbp_name + ".fbp";
                                    }
                                    if (!isProjectExists($scope.prj_name)) {
                                        confirmProjectCreation($scope.prj_name, fbp_name, body);
                                        dialog.dialog("close");
                                    } else {
                                        sure_dialog("Project", "The project " + $scope.prj_name +
                                                    " already exists, do you want to override it?",
                                            function(close_id) {
                                                if(close_id) {
                                                    confirmProjectCreation($scope.prj_name, fbp_name, body);
                                                    dialog.dialog("close");
                                                } else {
                                                    $(".ui-dialog-buttonpane button:contains('Close')").button("enable");
                                                    $(".ui-dialog-buttonpane button:contains('Create')").button("enable");
                                                }
                                            });
                                    }
                                } else {
                                    alert("Invalid project or file name.");
                                }
                            },
                            Close: function() {
                                $(this).dialog("close");
                                }
                            },
                            close: function(ev, ui){
                                $(this).dialog("close");
                            }
                    });
                    dialog.dialog("open");
                };

                $scope.importGITProject = function () {
                    var dialog = $('<div id="importGITDialog"></div>').
                                 html($compile('<div class="spin_sync" style="margin-top: -9px; float: right; margin-right: 46px;"' +
                                               ' us-spinner="{radius:8.5, width:3, length: 4}"' +
                                               ' spinner-key="spinner-1"></div>' +
                                               '<input class="inputControls"' +
                                               ' type="text" style="width: 420px; outline: 0;"' +
                                               ' ng-model="gitRepoUrl" />')($scope)).
                    dialog({
                        title: "GIT repository URL",
                        autoOpen: false,
                        modal: true,
                        position: { at: "center top"},
                        height: 170,
                        width: 520,
                        closeOnEscape: false,
                        open: function(event, ui) {
                            $(".ui-dialog-titlebar-close").hide();
                            dialog.keyup(function(e) {
                                if (e.keyCode === $.ui.keyCode.ENTER) {
                                    $(".ui-dialog-buttonpane button:contains('Import')").click();
                                }
                            });
                        },
                        show: { effect: "fade", duration: 300 },
                        hide: {effect: "fade", duration: 300 },
                        resizable: 'disable',
                        buttons: {
                            "Import": function() {
                                $http.post('/api/git/repo/sync',{params: {
                                    "repo_url": $scope.gitRepoUrl,
                                }}).success(function(data) {
                                    $scope.refreshTree();
                                    $scope.libChecked = true;
                                    $scope.stopSpin();
                                    $(".ui-dialog-buttonpane button:contains('Close')").button("enable");
                                    $(".ui-dialog-buttonpane button:contains('Import')").button("enable");
                                    $scope.gitRepoUrl = "";
                                }).error(function(data){
                                    alert(data);
                                    $scope.stopSpin();
                                    $(".ui-dialog-buttonpane button:contains('Close')").button("enable");
                                    $(".ui-dialog-buttonpane button:contains('Import')").button("enable");
                                });
                                $scope.startSpin();
                                $(".ui-dialog-buttonpane button:contains('Close')").button("disable");
                                $(".ui-dialog-buttonpane button:contains('Import')").button("disable");
                            },
                            Close: function() {
                                $(this).dialog("close");
                            }
                        },
                    });
                    dialog.dialog("open");

                };

                function confirmFolderCreation(repo, name) {
                    name = normalizeName(name);
                    $http.post('/api/git/repo/create/folder',
                    {
                        params: { "folder_path": repo + name
                    }
                    }).success(function(data) {
                        $scope.refreshTree();
                    }).error(function(){
                        alert("Oh uh, something went wrong. Try again");
                    });
                }


                $scope.newFolder = function () {
                    var repo = filePath;
                    if (isLeaf) {
                        var cached = repo.split("/");
                        cached.pop();
                        repo = cached.join("/");
                    }
                    var dialog = $('<div></div>').
                                 html($compile('<input class="inputControls"' +
                                               ' type="text" style="width: 256px; outline: 0;"' +
                                               ' ng-model="folder_name" />')($scope)).
                    dialog({
                        title: "Choose the name of the new folder",
                        autoOpen: false,
                        modal: true,
                        position: { at: "center top"},
                        height: 167,
                        width: 300,
                        show: { effect: "fade", duration: 300 },
                        hide: {effect: "fade", duration: 300 },
                        resizable: 'disable',
                        open: function(event, ui) {
                            dialog.keyup(function(e) {
                                if (e.keyCode === $.ui.keyCode.ENTER) {
                                    $(".ui-dialog-buttonpane button:contains('Create')").click();
                                }
                            });
                        },
                        buttons: {
                            "Create": function() {
                                if ($scope.folder_name) {
                                    if (!isFileExists(repo, $scope.folder_name)) {
                                        confirmFolderCreation(repo + "/", $scope.folder_name);
                                        dialog.dialog("close");
                                    } else {
                                        sure_dialog("Folde", "The folder " + $scope.folder_name +
                                                      " already exists, do you want to override it?",
                                        function(close_id) {
                                            if(close_id) {
                                                confirmFolderCreation(repo + "/", $scope.folder_name);
                                                dialog.dialog("close");
                                            }
                                        });
                                    }
                                } else {
                                    alert("Oh uh, something went wrong. Try again");
                                }
                                $(this).dialog("close");
                            },
                            Cancel: function() {
                                $(this).dialog("close");
                                }
                            },
                            close: function(ev, ui){
                                $(this).dialog("close");
                            }
                    });
                    dialog.dialog("open");
                };

                function confirmFileCreation(repo, name) {
                    name = normalizeName(name);
                    $http.post('/api/git/repo/create/file',
                              {params: {"file_path": repo + name}
                    }).success(function(data) {
                        $scope.refreshTree();
                    }).error(function(){
                        alert("Oh uh, something went wrong. Try again");
                    });
                }

                $scope.createFile = function () {
                    var repo = filePath;
                    if (repo) {
                        if (isLeaf) {
                            var cached = repo.split("/");
                            cached.pop();
                            repo = cached.join("/");
                        }
                        var dialog = $('<div></div>').
                                   html($compile('<input class="inputControls"' +
                                                 ' type="text" style="width: 256px; outline: 0;"' +
                                                 ' ng-model="file_name" />')($scope)).
                        dialog({
                          title: "Choose the name of the new file",
                          autoOpen: false,
                          modal: true,
                          position: { at: "center top"},
                          height: 167,
                          width: 300,
                          show: { effect: "fade", duration: 300 },
                          hide: {effect: "fade", duration: 300 },
                          resizable: 'disable',
                          open: function(event, ui) {
                            dialog.keyup(function(e) {
                                if (e.keyCode === $.ui.keyCode.ENTER) {
                                    $(".ui-dialog-buttonpane button:contains('Create')").click();
                                }
                            });
                          },
                          buttons: {
                              "Create": function() {
                                  if ($scope.file_name) {
                                      if (!isFileExists(repo, $scope.file_name)) {
                                          confirmFileCreation(repo + "/", $scope.file_name);
                                          dialog.dialog("close");
                                      } else {
                                          sure_dialog("File", "The file " + $scope.file_name +
                                                      " already exists, do you want to override it?",
                                            function(close_id) {
                                                if(close_id) {
                                                    confirmFileCreation(repo + "/", $scope.file_name);
                                                    dialog.dialog("close");
                                                }
                                            });
                                      }

                                  } else {
                                      alert("Oh uh, something went wrong. Try again");
                                  }
                              },
                              Cancel: function() {
                                  $(this).dialog("close");
                                  }
                              },
                              close: function(ev, ui){
                                  $(this).dialog("close");
                              }
                      });
                      dialog.dialog("open");
                    } else {
                        console.log("Error: repository not selected");
                        alert("Folder destination must be selected!");
                    }
                };

                $scope.filesChanged = function(elm) {
                    $scope.files = elm.files;
                    $scope.$apply();
                };

                $scope.importFile = function () {
                    var file = filePath;
                    if (file) {
                        if (isLeaf) {
                            var cached = file.split("/");
                            cached.pop();
                            file = cached.join("/");
                        }
                        if($scope.folder !== 'demo') {
                        var dialog = $('<div></div>').
                                html($compile('<form ng-submit="Upload()">'+
                                            ' <div class="spin_sync" style="margin-top: -9px; float: right;'+
                                            ' margin-right: 46px;" us-spinner="{radius:6.5, width:3, length:4}"'+
                                            ' spinner-key="spinner-1"></div> <input'+
                                            ' type="file" id="inputFile" class="inputFileControls"' +
                                            ' onChange="angular.element(this).scope().filesChanged(this)"/>'+
                                            ' <label for="inputFile">Select File</label>'+
                                            ' <li class="list-item" ng-repeat="file in files">{{file.name}}</li>'+
                                            ' </form>')($scope)).
                        dialog({
                          title: "Choose file to import",
                          autoOpen: false,
                          modal: true,
                          position: { at: "center top"},
                          height: 175,
                          width: 520,
                          show: { effect: "fade", duration: 300 },
                          hide: { effect: "fade", duration: 300 },
                          resizable: 'disable',
                          buttons: {
                              "Upload": function() {
                                  var formdata = new FormData();
                                  var data=String(file);
                                  formdata.append("upload_path", data);
                                  angular.forEach($scope.files,function(file) {
                                  formdata.append('file', file);
                                  });
                                  $http.post('/api/file/upload',formdata, {
                                    transformRequest: angular.identity,
                                    headers:{'Content-Type':undefined}
                                  })
                                    .success(function(d) {
                                        $scope.refreshTree();
                                        $scope.stopSpin();
                                        $(".ui-dialog-buttonpane button:contains('Cancel')").button("enable");
                                        $(".ui-dialog-buttonpane button:contains('Upload')").button("enable");
                                    })
                                    .error(function(d) {
                                        alert(d);
                                        $scope.stopSpin();
                                        $(".ui-dialog-buttonpane button:contains('Cancel')").button("enable");
                                        $(".ui-dialog-buttonpane button:contains('Upload')").button("enable");
                                    });
                                $scope.startSpin();
                                $(".ui-dialog-buttonpane button:contains('Cancel')").button("disable");
                                $(".ui-dialog-buttonpane button:contains('Upload')").button("disable");
                                $(this).dialog("close");
                              },
                              Cancel: function() {
                                  $(this).dialog("close");
                                  }
                              },
                              close: function(ev, ui) {
                                  $(this).dialog("close");
                              }
                      });
                      dialog.dialog("open");
                        } else {
                            alert("Error: Upload to demo folder is not allowed");
                        }
                    } else {
                        alert("Folder destination must be selected!");
                    }
                };

                var saveFile = (function () {
                    var a = document.createElement('a');
                    document.body.appendChild(a);
                    a.style = 'display: none';
                    return function (blob, file_name) {
                        var url = window.URL.createObjectURL(blob);
                        a.href = url;
                        a.download = file_name;
                        a.click();
                        setTimeout( function() {
                            window.URL.revokeObjectURL(url);
                        }, 100);
                    };
                }());

                $scope.exportFile = function () {
                    var file = filePath;
                    if (file) {
                        if (isLeaf) {
                            $http.get('/api/file/download',
                                { params: { "file": file },
                                responseType: "arraybuffer"
                            }).success( function (data, status, headers, config) {
                                var f = headers('Content-Disposition').match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/g);
                                var file_name = String(f).split('=').pop().slice(1, -1);
                                var mime_type = headers('Content-Type');
                                var blob = new Blob([data], { type: String(mime_type) });
                                saveFile(blob, file_name);
                            }).error( function (data, status, headers, config) {
                                alert('Error: Unable to Download File');
                            });
                        } else {
                            alert('Error: Cannot Download Folder');
                        }
                    } else {
                        alert('Please select File first!');
                    }
                };

                $scope.getNodes = function () {
                    $http.get('/api/nodetypes/get')
                    .success(function (data) {
                        if (data) {
                            for (var i in data) {
                                for (var j in data[i]) {
                                    nodenames.push(data[i][j].name);
                                    inports.push(data[i][j].in_ports);
                                    outports.push(data[i][j].out_ports);
                                    if (data[i][j].options) {
                                        members.push(data[i][j].options.members);
                                        membernodes.push(data[i][j].name);
                                    }
                                }
                            }
                        }
                    }).error(function (data) {
                        console.log("Error getting nodetypes: " + data);
                    });
                };

                $scope.getNodes();

                var prettifyNodetype = function (nodetype) {
                    var temp = nodetype.split('/');
                    temp[0] = temp[0].toUpperCase();
                    if (temp[1]) {
                        temp[1] = temp[1].charAt(0).toUpperCase() + temp[1].slice(1);
                        return temp[0] + ' ' + temp[1];
                    }
                };

                var autoCompleter = {
                    getCompletions: function(editor, session, pos, prefix, callback) {
                        var node_pos, brackets, brack_pos, colon, colon_pos, nodeval,
                            val_pos, ports, values, valCmd, portsList = [], dataTypeList = [];
                        var curLine = session.getDocument().getLine(pos.row);
                        var curTokens = curLine.slice(0, pos.column).split(/\s+/);
                        var valTokens = curLine.slice(0, pos.column).split(':');
                        if (valTokens[0]) {
                            nodeval = valTokens[0].lastIndexOf('(');
                            if (nodeval > -1) {
                                valCmd = valTokens[0].slice(nodeval + 1);
                            }
                        }
                        var curCmd = curTokens[0];
                        if(!curCmd) return;
                        node_pos = nodenames.indexOf(curTokens[curTokens.length-2]);
                        if (curTokens[curTokens.length-2]) {
                            brackets = curTokens[curTokens.length-2].split('(');
                            if (brackets[1]) {
                                colon = brackets[1].split(':')[0];
                                colon_pos = nodenames.indexOf(colon);
                            }
                            brack_pos = nodenames.indexOf(brackets[brackets.length-1].slice(0, -1));
                        }
                        if (valCmd) {
                            val_pos = membernodes.indexOf(valCmd);
                        }
                        if (node_pos > -1 || brack_pos > -1 || colon_pos > -1 || val_pos > -1) {
                            values = members[val_pos];
                            if (outports[node_pos]) {
                                ports = outports[node_pos];
                            } else if (outports[brack_pos]) {
                                ports = outports[brack_pos];
                            } else if (outports[colon_pos]) {
                                ports = outports[colon_pos];
                            } else if (inports[node_pos]) {
                                ports = inports[node_pos];
                            } else if (inports[brack_pos]) {
                                ports = inports[brack_pos];
                            } else if (inports[colon_pos]) {
                                ports = inports[colon_pos];
                            }
                            if (values) {
                                for (var i in values) {
                                    portsList.push(values[i].name);
                                    dataTypeList.push(values[i].data_type);
                                }
                                var getDataType = function (word) {
                                    var index = portsList.indexOf(word);
                                    return dataTypeList[index];
                                };
                                callback(null, portsList.map(function(word) {
                                    return {
                                        caption: word,
                                        value: word,
                                        meta: getDataType(word)
                                    };
                                }));
                            } else if (ports) {
                                for (var j in ports) {
                                    portsList.push(ports[j].name);
                                }
                                callback(null, portsList.map(function(word) {
                                    return {
                                        caption: word,
                                        value: word,
                                        meta: "PORT"
                                    };
                                }));
                            } else {
                                callback(null, nodenames.map(function(word) {
                                    return {
                                        caption: prettifyNodetype(word),
                                        value: word,
                                        meta: "nodetype"
                                    };
                                }));
                            }
                        } else {
                            callback(null, nodenames.map(function(word) {
                                return {
                                    caption: prettifyNodetype(word),
                                    value: word,
                                    meta: "nodetype"
                                };
                            }));
                        }
                    }
                };

                langtools.addCompleter(autoCompleter);

                $scope.remove = function () {
                    if (filePath) {
                        var file_name = filePath.split("/").pop();
                        var repo = filePath.split("repos/")[1].split("/")[0];
                        if (repo !== "solettaproject") {
                            sure_dialog("Remove", "Are you sure you want to delete " + file_name + "?", function(close_id) {
                                if(close_id) {
                                    $http.post('/api/git/repo/delete/file',
                                        {params: {
                                                     "file_path": filePath
                                                 }
                                        }).success(function(data) {
                                            $scope.refreshTree();
                                        }).error(function(){
                                            alert("Oh uh, something went wrong. Try again");
                                        });
                                }
                            });
                        } else {
                            alert("You can't modify solettaproject repository");
                        }
                    } else {
                        alert("You have to select a file or folder before");
                    }

                };

                $scope.startServiceStatus = function () {
                    promiseServiceStatus = $interval(function () {
                        $interval.cancel(promiseServiceStatus);
                        $scope.getServiceStatus();
                    }, $scope.refreshPeriod);
                };

                $scope.getServiceStatus = function () {
                    if ($scope.isServiceRunningReturn === false) {
                        $scope.isServiceRunningReturn = true;
                        $http.get('/api/service/status',
                        {
                            params: { "service": "fbp-runner.service"}
                        }).success(function(data) {
                            $scope.isServiceRunningReturn = false;
                            $scope.ServiceStatus = data.trim();
                            if ($scope.ServiceStatus.indexOf("active (running)") > -1) {
                                $scope.isServiceRunning = true;
                            } else {
                                $scope.isServiceRunning = false;
                            }

                            $scope.ServiceStatus = $scope.ServiceStatus.replace(/since.*;/,"");

                            if ($scope.ServiceStatus) {
                                $scope.ServiceStatus = "FBP Running Status: " + $scope.ServiceStatus;
                            }

                        }).error(function(){
                            $scope.isServiceRunningReturn = false;
                            $scope.ServiceStatus = "Failed to get service information";
                        });
                    }
                    $scope.startServiceStatus();
                };

                $scope.refreshTree = function () {
                    $('#jstree').jstree(true).refresh();
                };

                $scope.startSpin = function () {
                    usSpinnerService.spin('spinner-1');
                };

                $scope.stopSpin = function () {
                    usSpinnerService.stop('spinner-1');
                };

                $scope.processRunClass = function () {
                    if (!$scope.runConf) {
                        return "disable_div";
                    } else {
                        if ($scope.runningStartStop) {
                            return "button_loading";
                        } else {
                            if ($scope.isServiceRunning) {
                                return "button_stop";
                            } else {
                                if ($scope.fbpType === true) {
                                    return "button_run_on";
                                } else {
                                    return "button_run_off";
                                }
                            }
                        }
                    }
                };

                this.menuAction = function(name, ev) {
                    switch(name) {
                        case "file.projectnew":
                            $scope.createProjectFromScratch();
                            break;
                        case "file.folder":
                            $scope.newFolder();
                            break;
                        case "file.new":
                            $scope.createFile();
                            break;
                        case "file.save":
                            $scope.saveFileManually();
                            break;
                        case "file.importfile":
                            $scope.importFile();
                            break;
                        case "file.exportfile":
                            $scope.exportFile();
                            break;
                        case "file.remove":
                            $scope.remove();
                            break;
                        case "file.import":
                            $scope.importGITProject();
                            break;
                        case "edit.undo":
                            editor.session.getUndoManager().undo();
                            break;
                        case "edit.redo":
                            editor.session.getUndoManager().redo();
                            break;
                        case "edit.copy":
                            $scope.clipboard = editor.getCopyText();
                            break;
                        case "edit.paste":
                            editor.insert($scope.clipboard, true);
                            break;
                        case "edit.selectall":
                            editor.selectAll();
                            break;
                        case "view.code":
                            $scope.codeChecked = !$scope.codeChecked;
                            if ($scope.codeChecked) {
                                $scope.showhideCode = "Hide Code Viewer";
                            } else {
                                $scope.showhideCode = "Show Code Viewer";
                            }
                            break;
                        case "view.flow":
                            $scope.svgChecked = !$scope.svgChecked;
                            if ($scope.svgChecked) {
                                $scope.showhideFlow = "Hide Flow Viewer";
                            } else {
                                $scope.showhideFlow = "Show Flow Viewer";
                            }
                            break;
                        case "view.project":
                            $scope.libChecked = !$scope.libChecked;
                            if ($scope.libChecked) {
                                $scope.showhideProject = "Hide Project Viewer";
                            } else {
                                $scope.showhideProject = "Show Project Viewer";
                            }
                            break;
                    }
                };

                $scope.processLoginClass = function () {
                    if (!$scope.loginConf) {
                        return "disable_div";
                    } else {
                        return "button_login_on";
                    }
                };
            }
    ]);
}());
