#!/usr/bin/cjs

imports.gi.versions.Gtk = '3.0';

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const WebKit =  imports.gi.WebKit2;
const Gettext = imports.gettext;

const app = new Gtk.Application({ application_id: 'gcalendar.eventdisplay' });

const UUID_GCALENDAR = "googleCalendar@javahelps.com";
Gettext.bindtextdomain(UUID_GCALENDAR, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID_GCALENDAR, str);
}


function getStdIn() {
  const stdinStream = new Gio.DataInputStream({
    base_stream: new Gio.UnixInputStream({ fd: 0}),
  });

  let buf = '';
  while ( [str, len] = stdinStream.read_line_utf8(null) ) {
    if (len < 1) {
      break;
      }
      buf += str + '\n';
  }
  return buf;
}

function getStatusStr( respStat ) {
  let retStr = '';
  
    if (respStat=='needsAction') {
      retStr += '\u2610';
    }

    if (respStat=='confirmed') {
      retStr += '\u2611\ufe0f';
    }

    if (respStat=='accepted') {
      retStr += '\u2611';
    }

    if (respStat=='rejected') {
      retStr += '\u2718';
    }

    if (respStat=='tentative') {
      retStr += '\u2370';
    }

  return retStr;  
}

function getNameStr(orgObj, subject ='') {
  let retStr = '';
  
  if (orgObj.hasOwnProperty('responseStatus')) {
    retStr += getStatusStr(orgObj.responseStatus) + ' - ';
  }
  
  let displayName = 'unknown';
  
  if (orgObj.hasOwnProperty('displayName') && orgObj) {
    displayName = orgObj['displayName'];
  } 
  if (orgObj.hasOwnProperty('email')) {
    if  (displayName=='unknown') {
      displayName = orgObj.email;
    }
    retStr += '<a target="_blank" href="mailto:' + orgObj['email'] + '?subject=' +  encodeURIComponent('Re: ' + subject) + '">' + displayName + '</a>';
  } else {
    retStr += displayName;
  }
  
  return retStr;
}

app.connect('activate', () => {
  const window = new Gtk.ApplicationWindow({ application: app });
  window.set_title('Event: ' + event_title);
  
  let sizex = GLib.getenv('GCAL_EVENTVIEW_SIZEX') ?? 800;
  let sizey = GLib.getenv('GCAL_EVENTVIEW_SIZEY') ?? 600;
  
  window.set_default_size(sizex, sizey);
  
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });

  const buttonBox = new Gtk.ButtonBox({ orientation: Gtk.Orientation.VERTICAL, layout_style: Gtk.ButtonBoxStyle.EXPAND });
  const buttonClose = new Gtk.Button({ label: 'Close'});
  buttonClose.connect('clicked', () => {
    app.quit();
  } );
  
  buttonBox.add(buttonClose);

  const webView = new WebKit.WebView({expand: true});
  webView.get_settings().set_enable_javascript(false);
  webView.load_html(event_body,null);
  webView.connect('decide-policy', (view, decision, type) => {

    if ( type == WebKit.PolicyDecisionType.NAVIGATION_ACTION  || type == WebKit.PolicyDecisionType.NEW_WINDOW_ACTION ) {
    
      let uri = decision.get_navigation_action().get_request().get_uri(); 
    
      if (uri=='about:blank') {
        return false;
      }
      
      console.log('CallingURI: ', uri);
      
      let [spwnsuccess, argv] = GLib.shell_parse_argv("xdg-open '"+uri+"'");
      let spawn_flags = GLib.SpawnFlags.SEARCH_PATH
                      | GLib.SpawnFlags.STDOUT_TO_DEV_NULL
                      | GLib.SpawnFlags.STDERR_TO_DEV_NULL;
      let [success, pid] = GLib.spawn_async(null, argv, null, spawn_flags, null);
      
      decision.ignore();
      return true;
    }
    
    decision.ignore();
    return true;
  } );
  
  box.add(buttonBox);
  box.add(webView);
  window.add(box);

  window.show_all();
});

const inJSON = JSON.parse( getStdIn() ) ;

const event_description = inJSON.description ?? '';
const event_title	  = inJSON.name ?? inJSON.summary ?? '';
const event_status	  = inJSON.status ?? '';
const event_location      = inJSON.location ?? '';  
const event_organizer	  = inJSON.organizer ?? {};            
const event_attendees	  = inJSON.attendees ?? [];

const startDate = new Date(Date.parse(inJSON.startDate ?? ''));
const endDate   = new Date(Date.parse(inJSON.endDate ?? ''));

const LCTIME = GLib.getenv('LC_TIME').replace(/_/gm, '-').replace(/\..*/gm, '');

const event_start = startDate.toLocaleDateString(LCTIME) + ' ' + ( inJSON.startTime ?? '' );
const event_end   = endDate.toLocaleDateString(LCTIME) + ' ' + ( inJSON.endTime ?? '');


event_body = 
  '<table style="background: #D0D0F0; padding: 5px;" width="100%" border="1px">' +
    '<tr><td colspan="2"><h1>' + getStatusStr(event_status) + ' - '  + event_title + '<h1></td></tr>' +
    '<tr><td colspan="2"><h2>[ ' + event_start + ' ... ' + event_end + ' ]</h2></td></tr>' +
    '<tr><td><h3>' + _('Location') + '</h3></td><td><h2>' + event_location + '</h2></td></tr>' +
    '<tr><td><h3>' + _('Organizer') + '</h3></td><td>' + getNameStr(event_organizer, event_title + ' - ' + event_start) + '</td></tr>' +
    '<tr><td><h3>' + _('Attendees') + '</h3></td><td>' 
    ;

if (typeof event_attendees != 'string') {
  event_attendees.forEach( item =>  {
    event_body += getNameStr(item, event_title + ' ' + event_start)+ ',<br> ';
  });   
}
event_body += '</td></tr></table>'; 
event_body += event_description;

app.run([]);
