import { useState } from "react";
import { useNavigate, useLocation, Link as RouterLink } from "react-router";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import MenuIcon from "@mui/icons-material/Menu";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import EventIcon from "@mui/icons-material/Event";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import PlaceIcon from "@mui/icons-material/Place";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import { useTheme } from "~/context/ThemeContext";
import type { User } from "~/utils/types";

const DRAWER_WIDTH = 260;

interface AppShellProps {
  user: User;
  children: React.ReactNode;
}

const userNav = [
  { label: "Dashboard", path: "/", icon: <SportsSoccerIcon /> },
  { label: "Games", path: "/games", icon: <EventIcon /> },
  { label: "Stats", path: "/stats", icon: <LeaderboardIcon /> },
  { label: "Profile", path: "/profile", icon: <PersonIcon /> },
];

const adminNav = [
  { label: "Users", path: "/admin/users", icon: <GroupsIcon /> },
  { label: "Fields", path: "/admin/fields", icon: <PlaceIcon /> },
  { label: "Awards", path: "/admin/awards", icon: <EmojiEventsIcon /> },
];

export function AppShell({ user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminUser = user.role === "admin" || user.role === "superadmin";

  // Bottom nav value for mobile
  const bottomNavValue = (() => {
    if (location.pathname === "/") return 0;
    if (location.pathname.startsWith("/games")) return 1;
    if (location.pathname.startsWith("/stats")) return 2;
    if (location.pathname.startsWith("/profile")) return 3;
    return -1;
  })();

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          component="img"
          src="/logo.jpeg"
          alt="MassEliteFC"
          sx={{ width: 36, height: 36, borderRadius: "50%" }}
        />
        <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
          MassEliteFC
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1 }}>
        {userNav.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={location.pathname === item.path}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      {isAdminUser && (
        <>
          <Divider />
          <List
            subheader={
              <Typography
                variant="overline"
                sx={{ px: 2, py: 1, display: "block", color: "text.secondary" }}
              >
                Admin
              </Typography>
            }
          >
            {adminNav.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={location.pathname === item.path}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={toggleTheme}>
            <ListItemIcon>
              {isDark ? <LightModeIcon /> : <DarkModeIcon />}
            </ListItemIcon>
            <ListItemText primary={isDark ? "Light Mode" : "Dark Mode"} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              navigate("/auth/logout", { replace: true });
            }}
          >
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Log Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: "primary.main",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </Avatar>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            bgcolor: "background.paper",
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            bgcolor: "background.paper",
            borderRight: 1,
            borderColor: "divider",
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          pb: { xs: "80px", md: 3 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: "56px", sm: "64px" },
        }}
      >
        {children}
      </Box>

      {/* Mobile bottom navigation */}
      <BottomNavigation
        value={bottomNavValue}
        showLabels
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          height: 64,
          "& .MuiBottomNavigationAction-root": {
            minWidth: 0,
            py: 1,
          },
        }}
      >
        <BottomNavigationAction
          label="Home"
          icon={<SportsSoccerIcon />}
          component={RouterLink}
          to="/"
        />
        <BottomNavigationAction
          label="Games"
          icon={<EventIcon />}
          component={RouterLink}
          to="/games"
        />
        <BottomNavigationAction
          label="Stats"
          icon={<LeaderboardIcon />}
          component={RouterLink}
          to="/stats"
        />
        <BottomNavigationAction
          label="Profile"
          icon={<PersonIcon />}
          component={RouterLink}
          to="/profile"
        />
      </BottomNavigation>
    </Box>
  );
}
