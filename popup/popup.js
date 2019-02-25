// popup.js
//
//

'use strict';

(function() {
  const SRC_PERMS = {
    "script": 0x01,
    "img": 0x02,
    "frame": 0x04,
    "media": 0x08,
    "object": 0x10,
  };
  const DEFAULT_PERMS = {
    "script-default": 0x0100,
    "img-default": 0x0200,
    "frame-default": 0x0400,
    "media-default": 0x0800,
    "object-default": 0x1000,
  };

  var reload = 0;

  var dbg = console.log;

  //
  dbg("popup:");

  //
  browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
    var tabid = tabs[0].id;
    browser.runtime.sendMessage({
      tabid: tabid,
      command: "get",
    }).then((r) => {
      dbg("popup: get="+r.p);
      var perms = r.p;
      // current tab
      for (const p in SRC_PERMS) {
        var id = p;
        if (perms & SRC_PERMS[p]) {
          document.getElementById(id).classList.add("enable")
        } else {
          document.getElementById(id).classList.add("disable")
        }
      }
      // new tab
      for (const p in DEFAULT_PERMS) {
        var id = p;
        if (perms & DEFAULT_PERMS[p]) {
          document.getElementById(id).classList.add("enable")
        } else {
          document.getElementById(id).classList.add("disable")
        }
      }
      // redraw
      document.getElementById('panel').style.display = 'block';
    });
  });

  //
  document.addEventListener("click", (e) => {
    dbg("popup: click");
    var id = e.target.id;
    var classList = e.target.classList;

    dbg("popup: id=" + id);
    dbg("popup: classList=" + JSON.stringify(classList, null, '\t'));

    var command;
    if (classList.contains("enable")) {
      classList.remove("enable");
      command = "disable";
    } else if (classList.contains("disable")) {
      classList.remove("disable");
      command = "enable";
    } else {
      return;
    }

    classList.add(command);

    browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
      var tabid = tabs[0].id;
      dbg("click: tabid="+tabid);

      if (SRC_PERMS.hasOwnProperty(id)) {
        reload = tabid;
      }

      browser.runtime.sendMessage({
        tabid: tabid,
        command: command,
        perm: id
      });
    });

  });

  //
  window.addEventListener('pagehide', () => {
    dbg("pagehide:");
    if (reload > 0) {
      browser.runtime.sendMessage({
        tabid: reload,
        command: "reload",
      });
    }
  }, {
    once: true
  });

})();
