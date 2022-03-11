# Paper conversion frontend

## Server configuration

Assuming you are running an Ubuntu/Debian-like server, install the required packages like this:

    sudo apt install libreoffice-nogui
    sudo apt install inkscape
    sudo apt install texlive-full
    sudo apt install libcap2-bin

Create an unprivileged *nodewww* user to run the server process (optional):

    sudo useradd -m nodewww
    sudo passwd nodewww

Then install conda (as the user that will run NodeJS) if you don't already have it:

    su nodewww
    cd
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
    sh Miniconda3-latest-Linux-x86_64.sh

Likewise install NVM, the NodeJS version manager, as that same user. NVM allows you to run a specific version of NodeJS, and as an unprivileged user:

    wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

Close and reopen the terminal or run `bash` to start a new one and get conda and NVM in the path. If the `nvm` command does not work, look for lines in the bottom of `~/.profile` related to NVM and copy them to `~/.bashrc`.

Then install the correct version of NodeJS:

    nvm install 17

And allow NodeJS to run on any port (such as 80):

    nvm use 17
    readlink -f `which node`  # Get path to node (paste into next line for NODE_PATH)
    setcap cap_net_bind_service=+ep NODE_PATH

## Installation

Clone this repository onto the server, e.g., into the home directory of the user that will run the server.

Also clone the *paper-convert-scripts* repository and complete the setup for that.

Then install the exact version of everything from `package-lock.json` by running:

    nvm use 17  # Make sure we're using the right version of NodeJS
    npm ci

At this point you should probably install security updates and restart your server:

    sudo apt upgrade
    sudo shutdown -r now

## Running the server

From the *paper-convert-www* directory, as your unprivileged user, run:

    nvm use 17
    conda activate paper_convert
    npm start

You might want to keep it running after logging out. In that case, replace `npm start` with `nohup npm start >> stdout.txt &`. Then if you want to stop it, run:

    killall node
