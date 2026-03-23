# Examples

## Camera-ready import setup

Open the `/camera/import` endpoint; for example, if running on localhost: <http://localhost:3000/camera/import>

You can edit the [submission.csv](./submission.csv) and [author.csv](./author.csv) example files to make example data. Characters such as commas and quotation marks will need special escaping in CSV data, so it is best to use a tool that handles these well such as Excel or Pandas.

Upload your submission/author CSV files to the import page using a test name. Currently there is no easy way to delete a "Venue" once created (apart from manually deleting the folder on the server), so pick a name like "test-xyz" that you won't need for the real venue.

If you want to add more papers after initially importing, or make a mistake and delete something from the venue unintentionally after importing, you can re-import over top of the same venue name. Existing papers will not be replaced; only previously deleted or new entries will be added.
