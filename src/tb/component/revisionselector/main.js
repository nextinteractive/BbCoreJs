/*
 * Copyright (c) 2011-2013 Lp digital system
 *
 * This file is part of BackBee.
 *
 * BackBuilder5 is free software: you can redistribute it and/or modify
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

require.config({
    paths: {

        //Templates
        'revisionselector.templates': 'src/tb/component/revisionselector/templates',

        //Managers
        'revisionselector.managers': 'src/tb/component/revisionselector/managers'
    }
});

define(
    'tb.component/revisionselector/main',
    [
        'Core',
        'Core/Renderer',
        'text!revisionselector.templates/tree.twig',
        'component!popin',
        'revisionselector.managers/Draft',
        'revisionselector.managers/Event',
        'revisionselector.managers/Save',
        'jquery',
        'component!translator',
        'jsclass'
    ],
    function (
        Core,
        Renderer,
        treeTemplate,
        PopinManager,
        DraftManager,
        EventManager,
        SaveManager,
        jQuery,
        translator
    ) {

        'use strict';

        var popinConfig = {
                width: 944,
                height: 'auto',
                modal: true
            },

            RevisionManager = new JS.Class({

                revisionSelectorClass: '.bb-revision-selector',
                seeDetailsClass: '.bb-revision-see-details',
                revisionListClass: '.bb-revision-list',

                /**
                 * Initialize of Revision manage
                 */
                initialize: function (config) {
                    var self = this;

                    this.config = config;

                    this.buildPopin();

                    this.selector = '#' + this.popin.getId() + ' ' + this.revisionSelectorClass;

                    Core.ApplicationManager.invokeService('content.main.getRepository').done(function (repository) {
                        self.repository = repository;
                    });

                    Core.ApplicationManager.invokeService('content.main.getSaveManager').done(function (ContentSaveManager) {
                        self.ContentSaveManager = ContentSaveManager;
                    });
                },

                /**
                 * Bind events
                 */
                bindEvents: function () {
                    var self = this;
                    jQuery(this.seeDetailsClass).on('click', function () {
                        jQuery(self.revisionListClass).toggle();
                    });
                },

                /**
                 * Build the popin
                 */
                buildPopin: function () {
                    var title = (this.config.popinTitle !== undefined) ? this.config.popinTitle : '';

                    this.popin = PopinManager.createPopIn({
                        position: { my: "center top", at: "center top+" + jQuery('#' + Core.get('menu.id')).height()}
                    });

                    this.popin.setTitle(title);

                    if (this.config.silent === true) {
                        popinConfig.modal = false;
                    }

                    this.popin.addOptions(popinConfig);
                },

                /**
                 * Apply the save to the callback
                 */
                save: function () {
                    if (this.config.hasOwnProperty('onSave')) {
                        this.config.onSave(SaveManager.save(this.selector), this.popin);
                    }
                },

                /**
                 * Show popin with revisions
                 */
                show: function () {
                    var self = this;

                    this.popin.display();

                    if (true === this.config.silent) {
                        jQuery('#' + this.popin.getId()).parents('.ui-dialog:first').addClass('hidden');
                    }

                    self.ContentSaveManager.save().done(function () {
                        self.repository.getDrafts().done(function (drafts) {
                            Core.Mediator.publish('on:draft:prerender', drafts);
                            var config = {
                                    items: DraftManager.computeDraft(drafts),
                                    title: self.config.title,
                                    noteMsg: self.config.noteMsg,
                                    noContentMsg: self.config.noContentMsg,
                                    questionMsg: self.config.questionMsg,
                                    treeTemplate: treeTemplate
                                },
                                buttonName = 'Ok';

                            if (config.items.length > 0) {
                                buttonName = translator.translate('yes');
                            }

                            self.popin.addButton(buttonName, jQuery.proxy(self.save, self));
                            if (config.items.length > 0) {
                                self.popin.addButton(translator.translate('no'), function () {
                                    self.popin.hide();
                                });
                            }

                            self.popin.setContent(Renderer.render(treeTemplate, config));
                            self.bindEvents();
                            EventManager.init(self.selector);

                            if (self.config.silent === true) {
                                self.save();
                            }
                        });
                    });
                }
            });

        return RevisionManager;
    }
);