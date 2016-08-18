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

define(
    [
        'Core',
        'content.dnd.manager',
        'content.mouseevent.manager',
        'content.save.manager',
        'content.manager',
        'content.container',
        'content.view.contribution.index',
        'content.view.edit.contribution.index',
        'definition.manager',
        'content.repository',
        'revision.repository',
        'keyword.repository',
        'component!revisionselector',
        'jquery',
        'content.widget.DialogContentsList',
        'component!notify',
        'content.widget.Edition',
        'component!mask',
        'component!translator'
    ],
    function (
        Core,
        DndManager,
        MouseEventManager,
        SaveManager,
        ContentManager,
        ContentContainer,
        ContributionIndexView,
        EditContributionIndexView,
        DefinitionManager,
        ContentRepository,
        RevisionRepository,
        KeywordRepository,
        RevisionSelector,
        jQuery,
        DialogContentsList,
        notify,
        Edition,
        MaskManager,
        Translator
    ) {
        'use strict';

        Core.ControllerManager.registerController('MainController', {
            appName: 'content',

            EDITABLE_ELEMENTS: ['Element/Text'],

            config: {
                imports: ['content.repository'],
                define: {
                    editionService: ['content.widget.Edition', 'content.manager'],
                    getPluginManagerService: ['content.pluginmanager'],
                    saveService: ['component!popin', 'component!translator'],
                    cancelService: ['component!translator'],
                    validateService: ['component!translator'],
                    getMediaDatastoreService: ['media.datastore']
                }
            },

            /**
             * Initialize of Bundle Controller
             */
            onInit: function () {
                this.repository = require('content.repository');
            },

            computeImagesInDOMService: function () {
                ContentManager.computeImages('body');
            },

            enablePluginOnIframeService: function (active) {
                var iframe = jQuery('[data-force-click=true]'),
                    $currentMask = iframe.siblings('.bb-mask');

                if (active) {
                    if ($currentMask.length === 0) {
                        iframe.prepend(jQuery('<div class="bb-mask"></div>'));
                    }
                } else {
                    $currentMask.remove();
                }
            },

            addDefaultZoneInContentSetService: function () {
                var self = this,
                    disable = false,
                    disableLink = function (event) {
                        if (!disable) {
                            event.preventDefault();
                        }
                    };

                Core.Scope.subscribe('block', function () {
                    var links = jQuery('#bb5-site-wrapper').find('a');

                    ContentManager.addDefaultZoneInContentSet(true);
                    disable = false;
                    links.on('click', disableLink);

                    links.each(function () {
                        var target = jQuery(this).get(0);

                        target.onClickBckp = target.onclick;
                        target.onclick = null;
                    });

                    self.enablePluginOnIframeService(true);

                }, function () {
                    var links = jQuery('#bb5-site-wrapper').find('a');

                    disable = true;
                    ContentManager.addDefaultZoneInContentSet(false);

                    links.each(function () {
                        jQuery(this).get(0).onclick = jQuery(this).get(0).onClickBckp;
                    });

                    self.enablePluginOnIframeService(false);
                });

                Core.Scope.subscribe('content', function () {
                    ContentManager.addDefaultZoneInContentSet(false);
                    self.enablePluginOnIframeService(true);
                }, function () {
                    ContentManager.addDefaultZoneInContentSet(false);
                    self.enablePluginOnIframeService(false);
                });
            },

            getSelectedContentService: function () {
                var content = null,
                    nodeSelected = jQuery('.bb-content-selected');

                if (nodeSelected.length > 0) {
                    content = ContentManager.getContentByNode(nodeSelected);
                }

                return content;
            },

            /**
             * Return the content repository
             */
            getRepositoryService: function () {
                return this.repository;
            },

            getKeywordRepositoryService: function () {
                return KeywordRepository;
            },

            getMediaDatastoreService: function (req) {
                return req('media.datastore');
            },

            /**
             * Return the dialog content list widget
             */
            getDialogContentsListWidgetService: function () {
                return DialogContentsList;
            },
            /**
             * Return the definition manager
             */
            getDefinitionManagerService: function () {
                return DefinitionManager;
            },

            /**
             * Return the definition manager
             */
            getContentManagerService: function () {
                return ContentManager;
            },

            getContentContainerService: function () {
                return ContentContainer;
            },

            getPluginManagerService: function (req) {
                return req('content.pluginmanager');
            },

            getSaveManagerService: function () {
                return SaveManager;
            },

            editionService: function (req) {
                var EditionHelper = req('content.widget.Edition'),
                    ContentHelper = req('content.manager');

                return {
                    EditionHelper: EditionHelper,
                    ContentHelper: ContentHelper
                };
            },

            /**
             * Call method save into SaveManager
             */
            saveService: function (req, confirm) {

                Core.Mediator.publish('before:content:save');

                var translator = req('component!translator'),
                    nbContents = SaveManager.getContentsToSave().length,
                    dfd = new jQuery.Deferred();

                if (confirm !== true) {
                    SaveManager.save().done(function () {
                        dfd.resolve(nbContents);
                    });
                } else {

                    var buttonValidate = $('button.bundle-toolbar-global-validate')[0];
                    if (nbContents > 0) {
                        SaveManager.save().done(function () {
                            notify.success(nbContents + ' ' + translator.translate('content_saved_sentence' + ((nbContents > 1) ? '_plural' : '')));
                            dfd.resolve(nbContents).then(function () {
                                buttonValidate.disabled = false;
                            });
                        });
                    } else {
                        notify.warning(translator.translate('no_content_save'));
                        dfd.resolve().then(function () {
                            buttonValidate.disabled = false;
                        });
                    }

                }

                return dfd.promise();
            },

            saveManagerService: function () {
                return SaveManager.save();
            },

            /**
             * Show the revision selector
             * @returns {undefined}
             */
            cancelService: function (req) {

                Core.Mediator.publish('before:content:cancel');

                var translator = req('component!translator'),
                    config = {
                        popinTitle: translator.translate('cancel_confirmation'),
                        noContentMsg: translator.translate('no_content_cancel'),
                        questionMsg: translator.translate('cancel_content_cancel_modifications'),
                        title: translator.translate('cancel_changes_content_below') + ' :',
                        onSave: function (data, popin) {
                            popin.mask();
                            RevisionRepository.save(data, 'revert').done(function () {
                                if (data.length === 0) {
                                    notify.warning(translator.translate('no_content_cancel'));
                                } else {
                                    notify.success(translator.translate('contents_canceled'));
                                    location.reload();
                                }

                                popin.unmask();
                                popin.hide();

                                Core.Mediator.publish('after:content:cancel');
                            });
                        }

                    };

                new RevisionSelector(config).show();
            },

            /**
             * Show the revision selector
             * @returns {undefined}
             */
            validateService: function (req, silent) {

                Core.Mediator.publish('before:content:validate');

                var translator = req('component!translator'),
                    config = {
                        popinTitle: translator.translate('validation_confirmation'),
                        noContentMsg: translator.translate('no_content_validate'),
                        noteMsg: translator.translate('validation_popin_note') + '<br />' + translator.translate('validation_unselect_note'),
                        questionMsg: translator.translate('validate_content_publish_modifications_online'),
                        title: translator.translate('confirm_saving_changes_content_below') + ' :',
                        silent: silent || false,
                        onSave: function (data, popin) {

                            popin.mask();

                            RevisionRepository.save(data, 'commit').done(function () {
                                if (data.length === 0) {
                                    notify.warning(translator.translate('no_content_validate'));
                                } else {
                                    notify.success(translator.translate('contents_validated'));
                                }

                                popin.unmask();
                                popin.hide();

                                Core.Mediator.publish('after:content:validate');
                            });
                        }
                    };

                new RevisionSelector(config).show();
            },

            getEditableContentService: function (content) {
                var self = this,
                    dfd = new jQuery.Deferred(),
                    result = [],
                    children = content.getNodeChildren(),
                    key,
                    element;

                if (content.isAContentSet()) {
                    dfd.resolve(result);

                    return dfd.promise();
                }

                if (jQuery.inArray(content.type, this.EDITABLE_ELEMENTS) !== -1) {
                    result.push(content);
                    dfd.resolve(result);
                } else {
                    for (key in children) {
                        if (children.hasOwnProperty(key)) {
                            element = ContentManager.getContentByNode(children[key]);
                            if (null !== element && jQuery.inArray(element.type, self.EDITABLE_ELEMENTS) !== -1) {
                                result.push(element);
                            }
                        }
                    }

                    dfd.resolve(result);
                }

                return dfd.promise();
            },

            contributionIndexAction: function () {

                var self = this,
                    mask,
                    contribArea;

                Core.ApplicationManager.invokeService('contribution.main.index').done(function (service) {
                    service.done(function () {
                        Core.Scope.register('contribution', 'block');

                        if (self.contribution_loaded !== true) {

                            contribArea = jQuery('#block-contrib-tab');

                            mask = MaskManager.createMask({
                                'message': Translator.translate('loading_blocks'),
                                'css': {
                                    'height': '97px',
                                    'position': 'static'
                                }
                            });

                            mask.mask(contribArea);

                            ContentRepository.findCategories().done(function (categories) {
                                var view = new ContributionIndexView({
                                    'categories': categories
                                });
                                view.render();

                                mask.unmask(contribArea);

                                self.contribution_loaded = true;

                                DndManager.initDnD();

                                Core.Mediator.publish('after:block-toolbar:shown');
                            });
                        }

                        Core.ApplicationManager.invokeService('contribution.main.manageTabMenu', '#edit-tab-block');
                    });
                });
            },

            contributionEditAction: function () {
                var self = this;

                Core.ApplicationManager.invokeService('contribution.main.index').done(function (service) {
                    service.done(function () {
                        Core.Scope.register('contribution', 'content');

                        if (self.contribution_edit_loaded !== true) {
                            var view = new EditContributionIndexView();
                            view.render();

                            DndManager.initDnD();
                            self.contribution_edit_loaded = true;
                        }

                        Core.ApplicationManager.invokeService('contribution.main.manageTabMenu', '#edit-tab-content');
                    });
                });
            },

            createView: function (Constructor, config, render) {
                var view = new Constructor(config);

                if (render) {
                    view.render();
                }
            },

            findDefinitionsService: function (page_uid) {
                return require('content.repository').findDefinitions(page_uid);
            },

            listenDOMService: function (definitions) {
                DefinitionManager.setDefinitions(definitions);

                Core.Scope.subscribe('content', function () {
                    DndManager.bindEvents();
                    MouseEventManager.enable(true);
                }, function () {
                    DndManager.unbindEvents();
                    MouseEventManager.enable(false);
                });

                Core.Scope.subscribe('block', function () {
                    DndManager.bindEvents();
                    MouseEventManager.enable(true);
                }, function () {
                    DndManager.unbindEvents();
                    MouseEventManager.enable(false);
                });

                MouseEventManager.listen();
            },

            showContentSelectorService: function () {
                var self = this;
                if (!this.ContentSelectorIsLoaded) {
                    require(['component!contentselector'], function (ContentSelector) {
                        if (self.ContentSelectorIsLoaded) { return; }
                        self.contentSelector = ContentSelector.createContentSelector({
                            mode: 'view',
                            resetOnClose: true
                        });
                        self.contentSelectorIsLoaded = true;
                        self.contentSelector.setContenttypes([]);
                        self.contentSelector.display();
                    });
                } else {
                    self.contentSelector.display();
                }
            },

            getContentPopins: function () {
                return Core.get('application.contribution').getPopins();
            },

            registerPopinService: function (id, popin) {
                this.getContentPopins()[id] = popin;
            },

            removePopinService: function (id) {
                delete this.getContentPopins()[id];
            },

            getPopinService: function (id) {
                return this.getContentPopins()[id];
            },

            getEditionWidgetService: function () {
                return Edition;
            }
        });
    }
);
