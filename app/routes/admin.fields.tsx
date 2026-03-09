import { Form, useActionData } from "react-router";
import type { Route } from "./+types/admin.fields";
import { requireAdmin } from "~/lib/middleware.server";
import { AppShell } from "~/components/AppShell";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import PlaceIcon from "@mui/icons-material/Place";
import AddIcon from "@mui/icons-material/Add";

export function meta() {
  return [{ title: "Fields | Admin | MassEliteFC" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const user = await requireAdmin(request, db);

  const fields = await db
    .prepare("SELECT * FROM fields ORDER BY is_default DESC, name ASC")
    .all();

  return { user, fields: fields.results };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  await requireAdmin(request, db);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add") {
    const name = (form.get("name") as string)?.trim();
    const address = (form.get("address") as string)?.trim();

    if (!name || !address) {
      return { error: "Name and address are required." };
    }

    await db
      .prepare("INSERT INTO fields (name, address) VALUES (?, ?)")
      .bind(name, address)
      .run();

    return { success: `${name} added.` };
  }

  if (intent === "delete") {
    const id = form.get("field_id") as string;

    // Check if field is used by any games
    const usage = await db
      .prepare("SELECT COUNT(*) as count FROM games WHERE field_id = ?")
      .bind(id)
      .first();

    if (usage && (usage.count as number) > 0) {
      return { error: "Cannot delete a field that has games associated with it." };
    }

    await db.prepare("DELETE FROM fields WHERE id = ?").bind(id).run();
    return { success: "Field deleted." };
  }

  return { error: "Unknown action." };
}

export default function AdminFieldsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, fields } = loaderData;

  return (
    <AppShell user={user}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Manage Fields
      </Typography>

      {actionData?.error && <Alert severity="error" sx={{ mb: 2 }}>{actionData.error}</Alert>}
      {actionData?.success && <Alert severity="success" sx={{ mb: 2 }}>{actionData.success}</Alert>}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 600 }}>
        {/* Existing Fields */}
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Current Fields
            </Typography>
            <List>
              {fields.map((f) => (
                <ListItem
                  key={f.id as string}
                  secondaryAction={
                    !(f.is_default as number) && (
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="field_id" value={f.id as string} />
                        <IconButton type="submit" edge="end" color="error" size="small">
                          <DeleteIcon />
                        </IconButton>
                      </Form>
                    )
                  }
                >
                  <PlaceIcon sx={{ mr: 2, color: "primary.main" }} />
                  <ListItemText
                    primary={f.name as string}
                    secondary={f.address as string}
                  />
                  {(f.is_default as number) === 1 && (
                    <Chip label="Default" size="small" sx={{ mr: 4 }} />
                  )}
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* Add New Field */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Add New Field
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="add" />
              <TextField name="name" label="Field Name" fullWidth required margin="normal" />
              <TextField
                name="address"
                label="Address"
                fullWidth
                required
                margin="normal"
                placeholder="123 Main St, City, MA 01234"
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mt: 2 }}
              >
                Add Field
              </Button>
            </Form>
          </CardContent>
        </Card>
      </Box>
    </AppShell>
  );
}
