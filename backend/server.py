from flask import Flask, request, jsonify
import os
import pty
import subprocess
import select

app = Flask(__name__)

# Global variables to store the master file descriptor and PID of the shell
master_fd = None
shell_pid = None


def start_shell():
    global master_fd, shell_pid
    master_fd, slave_fd = pty.openpty()
    shell_pid = os.fork()

    if shell_pid == 0:  # Child process
        os.setsid()
        os.dup2(slave_fd, 0)  # stdin
        os.dup2(slave_fd, 1)  # stdout
        os.dup2(slave_fd, 2)  # stderr
        os.close(slave_fd)
        os.execvp("bash", ["bash"])
    else:  # Parent process
        os.close(slave_fd)


@app.route("/execute", methods=["POST"])
def execute():
    global master_fd
    data = request.get_json()
    command = data.get("command") + "\n"

    os.write(master_fd, command.encode())

    output = []
    while True:
        r, _, _ = select.select([master_fd], [], [], 0.1)
        if master_fd in r:
            output.append(os.read(master_fd, 1024).decode())
        else:
            break

    return jsonify({"output": "".join(output), "error": ""})


@app.route("/cwd", methods=["GET"])
def get_cwd():
    global master_fd
    os.write(master_fd, b"pwd\n")

    output = []
    while True:
        r, _, _ = select.select([master_fd], [], [], 0.1)
        if master_fd in r:
            output.append(os.read(master_fd, 1024).decode())
        else:
            break

    cwd = "".join(output).strip().split("\n")[-1]
    return jsonify(cwd=cwd)


if __name__ == "__main__":
    start_shell()
    app.run(debug=True)
