// ==UserScript==
// @name         SetUserForMeet
// @namespace    https://github.com/sker65/userscripts/tree/main/meet
// @version      0.1
// @description  Always switch to authuser=1 if a blank meeting link is provided
// @author       You
// @match        https://meet.google.com/*
// @icon         https://cdn.icon-icons.com/icons2/2642/PNG/512/google_meet_camera_logo_icon_159349.png
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  //console.log(window.location);
  if( !window.location.search || window.location.search === "" ) {
      window.location.search = "?authuser=1";
  }
})();