# Permission-Aware Components Usage Guide

This guide shows how to use the permission-aware components in the mobile app.

## Available Components

### 1. PermissionButton

A generic permission-aware button wrapper that can wrap any button or render a TouchableOpacity.

**Basic Usage:**
```typescript
import {PermissionButton} from '../Components';
import {PAGE_NAMES} from '../constants/pageNames';

<PermissionButton
  pageName={PAGE_NAMES.ITEMS}
  action="insert"
  onPress={handleCreateItem}
  style={styles.button}
>
  <Text>Create Item</Text>
</PermissionButton>
```

**With Custom Button Component:**
```typescript
<PermissionButton
  pageName={PAGE_NAMES.ITEMS}
  action="modify"
  onPress={handleEdit}
  renderButton={({onPress, disabled}) => (
    <CustomButton
      title="Edit"
      onPress={onPress}
      disabled={disabled}
    />
  )}
/>
```

**Disable Instead of Hide:**
```typescript
<PermissionButton
  pageName={PAGE_NAMES.ITEMS}
  action="delete"
  onPress={handleDelete}
  disableInsteadOfHide={true}
  style={styles.button}
>
  <Text>Delete</Text>
</PermissionButton>
```

### 2. PermissionTextButton

Permission-aware wrapper for the existing TextButton component.

**Usage:**
```typescript
import {PermissionTextButton} from '../Components';
import {PAGE_NAMES} from '../constants/pageNames';

<PermissionTextButton
  pageName={PAGE_NAMES.ITEMS}
  action="insert"
  onPress={handleCreate}
  label="Create Item"
  buttonContainerStyle={styles.createButton}
  labelStyle={styles.buttonLabel}
  disabled={isLoading}
/>
```

### 3. PermissionIconButton

Permission-aware wrapper for the existing IconButton component.

**Usage:**
```typescript
import {PermissionIconButton} from '../Components';
import {PAGE_NAMES} from '../constants/pageNames';
import {icons} from '../constants';

<PermissionIconButton
  pageName={PAGE_NAMES.ITEMS}
  action="delete"
  onPress={handleDelete}
  icon={icons.delete}
  containerStyle={styles.deleteIcon}
/>
```

### 4. PermissionView

Conditionally renders children based on permission. Useful for wrapping sections of UI.

**Basic Usage:**
```typescript
import {PermissionView} from '../Components';
import {PAGE_NAMES} from '../constants/pageNames';

<PermissionView pageName={PAGE_NAMES.ITEMS} action="modify">
  <EditForm />
  <SaveButton />
</PermissionView>
```

**With Fallback:**
```typescript
<PermissionView
  pageName={PAGE_NAMES.ITEMS}
  action="delete"
  fallback={<Text>Delete permission required</Text>}
>
  <DeleteButton />
</PermissionView>
```

**Show with Reduced Opacity:**
```typescript
<PermissionView
  pageName={PAGE_NAMES.ITEMS}
  action="modify"
  showWithReducedOpacity={true}
>
  <EditForm />
</PermissionView>
```

## Action Types

The `action` prop accepts one of:
- `'read'` - View/read permission
- `'insert'` - Create permission
- `'modify'` - Edit/update permission
- `'delete'` - Delete permission

## Migration Example

**Before:**
```typescript
const {canEdit} = usePermissions();
const PAGE_NAME = PAGE_NAMES.ITEMS;

{canEdit(PAGE_NAME) && (
  <TouchableOpacity onPress={handleEdit}>
    <Text>Edit</Text>
  </TouchableOpacity>
)}
```

**After:**
```typescript
<PermissionButton
  pageName={PAGE_NAMES.ITEMS}
  action="modify"
  onPress={handleEdit}
>
  <Text>Edit</Text>
</PermissionButton>
```

## Best Practices

1. **Use PermissionButton for simple buttons** - Cleaner code, less boilerplate
2. **Use PermissionView for sections** - Wrap entire sections that require permissions
3. **Use disableInsteadOfHide sparingly** - Usually better to hide buttons than disable them
4. **Provide fallbacks when appropriate** - Show helpful messages when permission is denied
5. **Keep page names consistent** - Always use PAGE_NAMES constants

## Benefits

- ✅ Less boilerplate code
- ✅ Consistent permission checking
- ✅ Automatic hiding/disabled state
- ✅ Type-safe with TypeScript
- ✅ Reusable across the app
- ✅ Easy to maintain

