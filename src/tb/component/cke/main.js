/*
 * Copyright (c) 2011-2013 Lp digital system
 *
 * This file is part of BackBee.
 *
 * BackBee is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * BackBee is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with BackBee. If not, see <http://www.gnu.org/licenses/>.
 */

/*global CKEDITOR:false */
define(
    [
        'Core',
        'Core/Utils',
        'jquery',
        'component!rtemanager',
        'content.manager',
        'content.dnd.manager',
        'content.save.manager',
        'Core/ApplicationManager'
    ],
    function (Core, Utils, jQuery, RteManager, ContentManager, DNDManager, SaveManager, ApplicationManager) {
        'use strict';

        return RteManager.createAdapter('cke', {

            onInit: function () {
                this.editors = [];
                this.editableConfig = {};
                this.conciseInfos = {};
                this.identifierMap = {};
                this.lastInstance = null;
                this.externalPluginsPath = '';
                this.editorContainer = '#content-contrib-tab .bb-cke-wrapper';
                this.canHandleContentEdition = true;

                var lib = [],
                    self = this;

                if (this.config.hasOwnProperty('libName')) {
                    lib.push(this.config.libName);
                }

                if (this.config.hasOwnProperty('editableConfig')) {
                    this.editableConfig = this.config.editableConfig;
                }

                if (this.config.hasOwnProperty("externalPluginsPath") && typeof this.config.externalPluginsPath === 'string') {
                    this.externalPluginsPath = jQuery.trim(this.config.externalPluginsPath);
                }

                this.handleContentEvents();

                Utils.requireWithPromise(lib).done(function () {

                    self.addPluginSplitContent();

                    self.editor = CKEDITOR;
                    self.editor.config.disableNativeSpellChecker = false;
                    self.editor.disableAutoInline = true;
                    self.editor.dtd.$editable.span = 1;
                    self.editor.dtd.$editable.a = 1;
                    self.handleExtraPlugins(self.editor);
                    /* extends CKEditor config with user config here*/
                    jQuery.extend(self.editor.config, self.config);
                    self.editor.config.extraPlugins = "split";
                    CKEDITOR.on('instanceReady', jQuery.proxy(self.handleInstance, self));
                    CKEDITOR.on('currentInstance', function () {
                        self.stickEditor({
                            editor: CKEDITOR.currentInstance
                        });
                        self.lastInstance = CKEDITOR.currentInstance;
                    });

                    self.triggerOnReady(self);
                });
            },

            addPluginSplitContent: function () {
                var self = this;

                CKEDITOR.plugins.add('split', {
                    icons: 'split',
                    init: function (editor) {
                        editor.addCommand('insertSplitTag', {
                            exec: function () {
                                var element = CKEDITOR.dom.element.createFromHtml('<div class="bb-split"></div>');
                                CKEDITOR.currentInstance.insertElement(element);
                                self.splitContent();
                            }
                        });
                        editor.ui.addButton('Split', {
                            label: 'Spit content here',
                            command: 'insertSplitTag',
                            toolbar: 'insert'
                        });
                    }
                });
            },

            splitContent: function () {

                this.canHandleContentEdition = false;

                var self = this,
                    splittedContent,
                    $activeElement = jQuery(self.editor.document.$.activeElement),
                    $paragraph = $activeElement.parents('.bb-content:first'),
                    text = ContentManager.getContentByNode($activeElement),
                    paragraph = ContentManager.getContentByNode($paragraph),
                    currentNodeParent = paragraph.getParent(),
                    siblingPosition = DNDManager.getPosition($paragraph, currentNodeParent.jQueryObject),
                    $split = $activeElement.find('.bb-split'),
                    $contents = $split.parent(':first').contents(),
                    prevValue = '',
                    afterValue = '',
                    spotted = false;

                $contents.each(function () {
                    var $element = jQuery(this),
                        nativeElement = $element.get(0),
                        value = '';

                    if (!$element.hasClass('bb-split')) {

                        value = nativeElement.nodeValue;
                        if (null === value) {
                            value = $element.get(0).outerHTML;
                        }

                        if (spotted) {
                            afterValue = afterValue + value;
                        } else {
                            prevValue = prevValue + value;
                        }
                    } else {
                        spotted = true;
                    }
                });

                ContentManager.maskMng.mask($paragraph);

                ContentManager.createElement(paragraph.type).done(function (content) {
                    splittedContent = ContentManager.buildElement({
                        'type': content.type,
                        'uid': content.uid
                    });

                    self.getCurrentTextElementNodeName(paragraph, text).done(function (name) {
                        jQuery.when(
                            self.updateNodeContent(paragraph, name, prevValue),
                            self.updateNodeContent(splittedContent, name, afterValue)
                        ).done(function () {
                            currentNodeParent.append(splittedContent, siblingPosition + 1).done(function () {

                                //prevent cke autosave
                                setTimeout(function () {
                                    SaveManager.clear();
                                }, 200);
                            });

                            $split.remove();
                        });
                    });
                });

                return false;
            },

            getCurrentTextElementNodeName: function (paragraph, text) {
                var dfd = new jQuery.Deferred(),
                    elementInfos;

                paragraph.getData("elements").done(function (elements) {
                    jQuery.each(elements, function (key) {
                        elementInfos = elements[key];
                        if (elementInfos.uid === text.uid) {
                            dfd.resolve(key);
                            return true;
                        }
                    });
                    dfd.reject();
                });

                return dfd.promise();
            },

            updateNodeContent: function (node, key, value) {
                var jQueryDfd = jQuery.Deferred(),
                    textElement;

                node.getData("elements").done(function (elements) {

                    textElement = elements[key];

                    if (!textElement) {
                        throw new Error(this.getCurrentContentType() + "must have a [body] element to be splittable.");
                    }

                    textElement = ContentManager.buildElement({
                        'type': textElement.type,
                        uid: textElement.uid
                    });

                    textElement.set("value", value);

                    jQueryDfd.resolve(node);
                });

                return jQueryDfd.promise();
            },

            saveChanges : function () {
                var dfd = new jQuery.Deferred();
                ApplicationManager.invokeService('content.main.save', true).done(function (servicePromise) {
                    servicePromise.done(dfd.resolve);
                });
                return dfd.promise();
            },

            handleContentEvents : function () {
                var self = this,
                    cb = function () {
                        if (self.lastInstance) {
                            self.lastInstance.fire("blur", {editor: self.lastInstance});
                        }
                    };

                jQuery(document).on('click', jQuery.proxy(this.blurEditor, this));
                Core.Mediator.subscribe('before:content:validate', cb);
                Core.Mediator.subscribe('before:content:save', cb);
            },

            /**
             * Telling cke where to look for extra plugins at the specified path
             **/
            handleExtraPlugins: function (editor) {
                if (!this.externalPluginsPath.length) { return false; }
                editor.plugins.basePath = this.externalPluginsPath;
            },


            blurEditor: function (e) {
                var isInEditorZone = jQuery(e.target).closest('.cke_top').length || jQuery(e.target).closest('.cke_dialog');
                if (isInEditorZone) {
                    return;
                }
                if (this.lastInstance) {
                    this.lastInstance.fire("blur", {editor: this.lastInstance});
                }
            },

            stickEditor: function (e) {
                if (!e.editor) {
                    return;
                }

                var editorHtml = jQuery("#cke_" + e.editor.name),
                    container = jQuery(this.editorContainer);

                if (container.find(editorHtml).length) {
                    return;
                }

                container.find('.default-message').addClass('hidden');

                container.append(editorHtml);
            },

            getEditableContents: function (content) {
                var dfd = new jQuery.Deferred();

                Core.ApplicationManager.invokeService('content.main.getEditableContent', content).done(function (promise) {
                    promise.done(function (editableContents) {
                        dfd.resolve(editableContents);
                    });
                });

                return dfd.promise();
            },

            applyToContent: function (content) {
                var self = this,
                    editable,
                    nodeSelector;

                this.getEditableContents(content).done(function (editableContents) {

                    if (!editableContents.length) {
                        return;
                    }

                    jQuery.each(editableContents, function (i) {
                        editable = editableContents[i];

                        if (!self.identifierMap[editable.uid]) {
                            self.identifierMap[editable.uid] = editable.jQueryObject.selector;
                        }
                        nodeSelector = self.identifierMap[editable.uid];
                        if (!jQuery.contains(document, editable.jQueryObject.get(0))) {
                            editable.jQueryObject = content.jQueryObject.find(nodeSelector).eq(0);
                        }

                        self.applyToElement(editable.jQueryObject);
                    });
                });
            },

            handleInstance: function (event) {
                var editor = event.editor;
                this.editors.push(editor);

                //editor.focus();

                editor.on("blur", jQuery.proxy(this.handleContentEdition, this));
            },

            handleContentEdition: function (evt) {
                if (this.canHandleContentEdition) {
                    if (evt.editor.checkDirty()) {
                        this.triggerOnEdit({
                            node: evt.editor.container.$,
                            data: evt.editor.getData()
                        });
                        /* save value here */
                        Core.ApplicationManager.invokeService('content.main.getContentManager').done(function (ContentManager) {
                            var content = ContentManager.getContentByNode(jQuery(evt.editor.container.$));
                            content.set('value', evt.editor.getData());
                        });
                    }
                } else {
                    this.canHandleContentEdition = true;
                }
            },

            applyToElement: function (element) {
                element = jQuery(element);

                if (!element.length) {
                    return;
                }

                if (element.hasClass('cke_editable_inline')) {
                    return true;
                }

                element.attr('contenteditable', true);

                var conf = element.data('rteconfig') || 'basic',
                    rteConfig = this.editableConfig[conf];

                if (!rteConfig) {
                    rteConfig = this.editableConfig.basic;
                }

                this.editor.inline(jQuery(element).get(0), rteConfig);
            },

            enable: function () { this.callSuper(); },

            disable: function () {
                var self = this,
                    editable;
                jQuery.each(this.editors, function (i) {
                    editable = self.editors[i];
                    jQuery(editable.container.$).removeClass('cke_editable cke_editable_inline');
                    jQuery(editable.container.$).removeAttr('contenteditable');
                    editable.destroy();
                });
                this.editors = [];
            },

            getEditor: function () {
                return this.editor;
            }
        });
    }
);