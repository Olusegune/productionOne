// Release builds are native GUI applications. Without this attribute Windows
// allocates a console window and treats it as the parent process, so closing the
// black console also closes Production One. Debug builds keep their console so
// development diagnostics remain available.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    production_guy_lib::run()
}
