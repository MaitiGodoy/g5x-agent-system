import paramiko
import os

SSH_KEY = os.path.expanduser('~/.ssh/id_ed25519')
PASSPHRASE = 'your_ssh_passphrase'
VPS_IP = '2.24.71.246'

local_base = r'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system'
remote_base = '/root/g5x-agent-system'

files_to_sync = [
    'api.js',
    'agent.js',
    'package.json',
    'public/index.html',
    'public/bridge.js'
]

print("Connecting to VPS via SSH...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    key = paramiko.Ed25519Key.from_private_key_file(SSH_KEY, password=PASSPHRASE)
    client.connect(VPS_IP, port=22, username='root', pkey=key, timeout=30)
    print("Connected successfully!")
    
    sftp = client.open_sftp()
    
    for f in files_to_sync:
        local_path = os.path.join(local_base, f.replace('/', os.sep))
        remote_path = f"{remote_base}/{f}"
        print(f"Uploading {local_path} -> {remote_path} ...")
        
        # Ensure remote subdirectory (like public/) exists
        remote_dir = os.path.dirname(remote_path)
        try:
            sftp.stat(remote_dir)
        except IOError:
            sftp.mkdir(remote_dir)
            
        sftp.put(local_path, remote_path)
        
    print("Files uploaded successfully!")
    sftp.close()
    
    print("\nRebuilding Docker containers on VPS...")
    stdin, stdout, stderr = client.exec_command(f'cd {remote_base} && (docker compose up -d --build || docker-compose up -d --build)')
    
    print("\n=== Docker Build Output ===")
    for line in stdout:
        print(line.strip())
        
    print("\n=== Docker Build Errors (if any) ===")
    for line in stderr:
        print(line.strip())
        
    print("\n=== Verifying Containers Status ===")
    stdin, stdout, stderr = client.exec_command('docker ps')
    for line in stdout:
        print(line.strip())
        
    client.close()
    print("\nDone deploying to VPS!")
except Exception as e:
    print(f"\n❌ Error during deploy: {type(e).__name__}: {e}")
