import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './styles.css';

const queryClient = new QueryClient();
const usersUrl = 'https://dummyjson.com/users';
const storageKey = 'exercise-2-users';

function getSavedChanges() {
  return JSON.parse(
    localStorage.getItem(storageKey) || '{"savedUsers":[],"deletedIds":[]}',
  );
}

async function getUsers() {
  const response = await fetch(`${usersUrl}?limit=20`);
  if (!response.ok) {
    throw new Error('Could not load users.');
  }

  const data = await response.json();
  const changes = getSavedChanges();
  let users = data.users.filter((user) => !changes.deletedIds.includes(user.id));

  users = users.map((user) => {
    const savedUser = changes.savedUsers.find((saved) => saved.id === user.id);
    return savedUser || user;
  });

  changes.savedUsers.forEach((savedUser) => {
    const alreadyInList = users.some((user) => user.id === savedUser.id);
    if (!alreadyInList && !changes.deletedIds.includes(savedUser.id)) {
      users.push(savedUser);
    }
  });

  return users;
}

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user) => {
      const response = await fetch(`${usersUrl}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        throw new Error('Could not create user.');
      }
      return response.json();
    },
    onSuccess: async (_data, user) => {
      const changes = getSavedChanges();
      changes.savedUsers.push({ ...user, id: Date.now(), serverId: 1 });
      localStorage.setItem(storageKey, JSON.stringify(changes));
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, serverId, user }) => {
      const response = await fetch(`${usersUrl}/${serverId || id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        throw new Error('Could not update user.');
      }
      return response.json();
    },
    onSuccess: async (_data, { id, user, serverId }) => {
      const changes = getSavedChanges();
      const oldUser = queryClient.getQueryData(['users'])?.find((item) => item.id === id);
      const updatedUser = { ...oldUser, ...user, id, serverId };
      const savedIndex = changes.savedUsers.findIndex((item) => item.id === id);

      if (savedIndex === -1) {
        changes.savedUsers.push(updatedUser);
      } else {
        changes.savedUsers[savedIndex] = updatedUser;
      }

      localStorage.setItem(storageKey, JSON.stringify(changes));
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user) => {
      const response = await fetch(`${usersUrl}/${user.serverId || user.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Could not delete user.');
      }
      return response.json();
    },
    onMutate: async (user) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const oldUsers = queryClient.getQueryData(['users']);

      queryClient.setQueryData(['users'], (users) =>
        users.filter((item) => item.id !== user.id),
      );

      return { oldUsers };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(['users'], context.oldUsers);
    },
    onSuccess: (_data, user) => {
      const changes = getSavedChanges();
      changes.savedUsers = changes.savedUsers.filter((item) => item.id !== user.id);
      changes.deletedIds.push(user.id);
      localStorage.setItem(storageKey, JSON.stringify(changes));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

function UserManagement() {
  const { data: users, isPending, isError, error, isFetching } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [editingId, setEditingId] = useState(null);
  const [editingServerId, setEditingServerId] = useState(null);
  const formMutation = editingId === null ? createUser : updateUser;

  function clearForm() {
    setName('');
    setEmail('');
    setRole('user');
    setEditingId(null);
    setEditingServerId(null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const user = { name, email, role };

    createUser.reset();
    updateUser.reset();
    deleteUser.reset();

    if (editingId === null) {
      createUser.mutate(user, { onSuccess: clearForm });
    } else {
      updateUser.mutate(
        { id: editingId, serverId: editingServerId, user },
        { onSuccess: clearForm },
      );
    }
  }

  function editUser(user) {
    createUser.reset();
    updateUser.reset();
    deleteUser.reset();
    setName(user.name || `${user.firstName} ${user.lastName}`);
    setEmail(user.email);
    setRole(user.role || 'user');
    setEditingId(user.id);
    setEditingServerId(user.serverId || null);
  }

  function deleteUserFromList(user) {
    createUser.reset();
    updateUser.reset();
    deleteUser.reset();
    deleteUser.mutate(user);
  }

  return (
    <main className="container">
      <h1>Exercise 2: User Management</h1>
      <p>Create, edit, and delete users.</p>

      <form className="user-form" onSubmit={handleSubmit}>
        <h2>{editingId === null ? 'Add a user' : 'Edit user'}</h2>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
        </label>
        <button type="submit" disabled={formMutation.isPending}>
          {formMutation.isPending ? 'Saving...' : editingId === null ? 'Create user' : 'Save changes'}
        </button>
        {editingId !== null && (
          <button type="button" onClick={clearForm}>Cancel</button>
        )}
        {createUser.isSuccess && <p className="success">User created.</p>}
        {updateUser.isSuccess && <p className="success">User updated.</p>}
        {formMutation.isError && <p className="error">{formMutation.error.message}</p>}
      </form>

      <section>
        <h2>Users</h2>
        {isPending && <p>Loading users...</p>}
        {isFetching && !isPending && <p>Updating users...</p>}
        {isError && <p className="error">{error.message}</p>}
        {users?.length === 0 && <p>No users found.</p>}
        {users?.map((user) => (
          <div className="user" key={user.id}>
            <div>
              <strong>{user.name || `${user.firstName} ${user.lastName}`}</strong>
              <span>{user.email}</span>
              <small>{user.role || 'user'}</small>
            </div>
            <button onClick={() => editUser(user)}>Edit</button>
            <button
              onClick={() => deleteUserFromList(user)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && deleteUser.variables?.id === user.id
                ? 'Deleting...'
                : 'Delete'}
            </button>
          </div>
        ))}
        {deleteUser.isSuccess && <p className="success">User deleted.</p>}
        {deleteUser.isError && (
          <p className="error">{deleteUser.error.message} The user was restored.</p>
        )}
      </section>

      <p className="note">
        DummyJSON does not save changes on its server, so successful changes are saved in this browser.
      </p>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserManagement />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
