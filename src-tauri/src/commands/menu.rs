#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

#[cfg(target_os = "macos")]
pub fn build_macos_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let file_new_project =
        MenuItem::with_id(app, "file.new", "New Project", true, Some("CmdOrCtrl+N"))?;
    let file_open_project =
        MenuItem::with_id(app, "file.open", "Open Project", true, Some("CmdOrCtrl+O"))?;
    let file_sep_1 = PredefinedMenuItem::separator(app)?;
    let file_save = MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?;
    let file_save_as = MenuItem::with_id(
        app,
        "file.saveAs",
        "Save As...",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let file_save_all = MenuItem::with_id(
        app,
        "file.saveAll",
        "Save All",
        true,
        Some("CmdOrCtrl+Alt+S"),
    )?;
    let file_sep_2 = PredefinedMenuItem::separator(app)?;

    let file_add_new_canvas = MenuItem::with_id(
        app,
        "file.add.newCanvas",
        "New Canvas",
        true,
        Some("CmdOrCtrl+Shift+C"),
    )?;
    let file_add_new_ladder = MenuItem::with_id(
        app,
        "file.add.newLadder",
        "New Ladder",
        true,
        Some("CmdOrCtrl+Shift+L"),
    )?;
    let file_add_new_scenario = MenuItem::with_id(
        app,
        "file.add.newScenario",
        "New Scenario",
        true,
        Some("CmdOrCtrl+Shift+N"),
    )?;
    let file_add_submenu = Submenu::with_items(
        app,
        "Add",
        true,
        &[
            &file_add_new_canvas,
            &file_add_new_ladder,
            &file_add_new_scenario,
        ],
    )?;

    let file_import_xg5000 = MenuItem::with_id(
        app,
        "file.import.xg5000",
        "Import program from XG5000",
        true,
        None::<&str>,
    )?;
    let file_import_submenu = Submenu::with_items(app, "Import", true, &[&file_import_xg5000])?;

    let file_sep_3 = PredefinedMenuItem::separator(app)?;
    let file_recent_projects_empty = MenuItem::with_id(
        app,
        "file.recent.none",
        "No recent projects",
        false,
        None::<&str>,
    )?;
    let file_recent_projects_submenu =
        Submenu::with_items(app, "Recent Projects", true, &[&file_recent_projects_empty])?;
    let file_sep_4 = PredefinedMenuItem::separator(app)?;
    let file_exit = MenuItem::with_id(app, "file.exit", "Exit", true, None::<&str>)?;
    let file_submenu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &file_new_project,
            &file_open_project,
            &file_sep_1,
            &file_save,
            &file_save_as,
            &file_save_all,
            &file_sep_2,
            &file_add_submenu,
            &file_import_submenu,
            &file_sep_3,
            &file_recent_projects_submenu,
            &file_sep_4,
            &file_exit,
        ],
    )?;

    let edit_undo = MenuItem::with_id(app, "edit.undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
    let edit_redo = MenuItem::with_id(app, "edit.redo", "Redo", true, Some("CmdOrCtrl+Y"))?;
    let edit_sep_1 = PredefinedMenuItem::separator(app)?;
    let edit_cut = MenuItem::with_id(app, "edit.cut", "Cut", true, Some("CmdOrCtrl+X"))?;
    let edit_copy = MenuItem::with_id(app, "edit.copy", "Copy", true, Some("CmdOrCtrl+C"))?;
    let edit_paste = MenuItem::with_id(app, "edit.paste", "Paste", true, Some("CmdOrCtrl+V"))?;
    let edit_sep_2 = PredefinedMenuItem::separator(app)?;
    let edit_preferences = MenuItem::with_id(
        app,
        "settings.open",
        "Preferences",
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let edit_submenu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &edit_undo,
            &edit_redo,
            &edit_sep_1,
            &edit_cut,
            &edit_copy,
            &edit_paste,
            &edit_sep_2,
            &edit_preferences,
        ],
    )?;

    let view_toggle_sidebar = MenuItem::with_id(
        app,
        "view.toggleLeftPanel",
        "Toggle Sidebar",
        true,
        Some("CmdOrCtrl+B"),
    )?;
    let view_toggle_panel_output =
        MenuItem::with_id(app, "view.panel.output", "Output", true, None::<&str>)?;
    let view_toggle_panel_problems =
        MenuItem::with_id(app, "view.panel.problems", "Problems", true, None::<&str>)?;
    let view_toggle_panel_terminal =
        MenuItem::with_id(app, "view.panel.terminal", "Terminal", true, None::<&str>)?;
    let view_toggle_panel_submenu = Submenu::with_items(
        app,
        "Toggle Panel",
        true,
        &[
            &view_toggle_panel_output,
            &view_toggle_panel_problems,
            &view_toggle_panel_terminal,
        ],
    )?;
    let view_sep_1 = PredefinedMenuItem::separator(app)?;
    let view_layouts_placeholder = MenuItem::with_id(
        app,
        "view.layouts.placeholder",
        "Layouts",
        false,
        None::<&str>,
    )?;
    let view_sep_2 = PredefinedMenuItem::separator(app)?;
    let view_zoom_in = MenuItem::with_id(app, "view.zoomIn", "Zoom In", true, Some("CmdOrCtrl++"))?;
    let view_zoom_out =
        MenuItem::with_id(app, "view.zoomOut", "Zoom Out", true, Some("CmdOrCtrl+-"))?;
    let view_submenu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &view_toggle_sidebar,
            &view_toggle_panel_submenu,
            &view_sep_1,
            &view_layouts_placeholder,
            &view_sep_2,
            &view_zoom_in,
            &view_zoom_out,
        ],
    )?;

    let simulation_start = MenuItem::with_id(app, "simulation.start", "Start", true, Some("F5"))?;
    let simulation_stop =
        MenuItem::with_id(app, "simulation.stop", "Stop", true, Some("Shift+F5"))?;
    let simulation_pause = MenuItem::with_id(app, "simulation.pause", "Pause", true, Some("F6"))?;
    let simulation_step = MenuItem::with_id(app, "simulation.step", "Step", true, Some("F10"))?;
    let simulation_sep_1 = PredefinedMenuItem::separator(app)?;
    let simulation_reset = MenuItem::with_id(app, "simulation.reset", "Reset", true, None::<&str>)?;
    let simulation_submenu = Submenu::with_items(
        app,
        "Simulation",
        true,
        &[
            &simulation_start,
            &simulation_stop,
            &simulation_pause,
            &simulation_step,
            &simulation_sep_1,
            &simulation_reset,
        ],
    )?;

    let modbus_server_settings = MenuItem::with_id(
        app,
        "modbus.serverSettings",
        "Server Settings",
        true,
        None::<&str>,
    )?;
    let modbus_sep_1 = PredefinedMenuItem::separator(app)?;
    let modbus_start_tcp = MenuItem::with_id(
        app,
        "modbus.startTcp",
        "Start TCP Server",
        true,
        None::<&str>,
    )?;
    let modbus_stop_tcp =
        MenuItem::with_id(app, "modbus.stopTcp", "Stop TCP Server", true, None::<&str>)?;
    let modbus_sep_2 = PredefinedMenuItem::separator(app)?;
    let modbus_start_rtu = MenuItem::with_id(
        app,
        "modbus.startRtu",
        "Start RTU Server",
        true,
        None::<&str>,
    )?;
    let modbus_stop_rtu =
        MenuItem::with_id(app, "modbus.stopRtu", "Stop RTU Server", true, None::<&str>)?;
    let modbus_sep_3 = PredefinedMenuItem::separator(app)?;
    let modbus_connection_status = MenuItem::with_id(
        app,
        "modbus.status",
        "Connection Status",
        true,
        None::<&str>,
    )?;
    let modbus_submenu = Submenu::with_items(
        app,
        "Modbus",
        true,
        &[
            &modbus_server_settings,
            &modbus_sep_1,
            &modbus_start_tcp,
            &modbus_stop_tcp,
            &modbus_sep_2,
            &modbus_start_rtu,
            &modbus_stop_rtu,
            &modbus_sep_3,
            &modbus_connection_status,
        ],
    )?;

    let help_documentation = MenuItem::with_id(
        app,
        "help.documentation",
        "Documentation",
        true,
        None::<&str>,
    )?;
    let help_sep_1 = PredefinedMenuItem::separator(app)?;
    let help_about = MenuItem::with_id(app, "help.about", "About", true, None::<&str>)?;
    let help_submenu = Submenu::with_items(
        app,
        "Help",
        true,
        &[&help_documentation, &help_sep_1, &help_about],
    )?;

    Menu::with_items(
        app,
        &[
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &simulation_submenu,
            &modbus_submenu,
            &help_submenu,
        ],
    )
}
