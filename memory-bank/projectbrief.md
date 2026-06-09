     1class Object;
enum StateTag : uint16_t;
using NativeObject = void*;
using SnapshotObjectId = uint32_t;
using ProfilerId = uint32_t;
struct CpuProfileDeoptFrame {
  int script_id;
  size_t position;
namespace internal {CREATE TABLESPACE syntax is used to create general tablespaces. A
general tablespace is a shared tablespace. It can hold multiple tables,
and supports all table row formats. General tablespaces can be created
in a location relative to or independent of the data directory.
fter creating an InnoDB general tablespace, you can use CREATE TABLE
tbl_name ... TABLESPACE [=] tablespace_name or ALTER TABLE tbl_name
TABLESPACE [=] tablespace_name to add tables to the tablespace. For
more information, see
https://dev.mysql.com/doc/refman/5.7/en/general-tablespaces.html.
Considerations for NDB Cluster
This statement is used to create a tablespace, which can contain one or
more data files, providing storage space for NDB Cluster Disk Data
tables (see
https://dev.mysql.ckm$e
om/doc/refman/5.7/en/mysql-cluster-disk-data.html).
One data file is created and added to the tablespace using this
statement. Additional data files may be added to the tablespace by
using the ALTER TABLESPACE statement (see [HELP ALTER TABLESPACE]).
All NDB Cluster Disk Data objects share the same namespace. This means
that each Disk Data object must be uniquely named (and not merely each
Disk Data object of a given type). For example, you cannot have a
tablespace and a log file g
roup with the same name, or a tablespace and
a data file with the same name.
A log file group of one or more UNDO log files must be assigned to the
tablespace to be created with the USE LOGFILE GROUP clause.
logfile_group must be an existing log file group created with CREATE
LOGFILE GROUP (see [HELP CREATE LOGFILE GROUP]). Multiple tablespaces
may use the same log file group for UNDO logging.
When setting EXTENT_SIZE or INITIAL_SIZE, you may optionally follow the
number with a one-letter 
abbreviation for an order of magnitude,
similar to those used in my.cnf. Generally, this is one of the letters
M (for megabytes) or G (for gigabytes).
INITIAL_SIZE and EXTENT_SIZE are subject to rounding as follows:
o EXTENT_SIZE is rounded up to the nearest whole multiple of 32K.
o INITIAL_SIZE is rounded down to the nearest whole multiple of 32K;
  this result is rounded up to the nearest whole multiple of
  EXTENT_SIZE (after any rounding).
NDB reserves 4% of a tablespace for
 data node restart operations. This
reserved space cannot be used for data storage. This restriction
applies beginning with NDB 7.6.
The rounding just described is done explicitly, and a warning is issued
by the MySQL Server when any such rounding is performed. The rounded
values are also used by the NDB kernel for calculating
INFORMATION_SCHEMA.FILES column values and other purposes. However, to
avoid an unexpected result, we suggest that you always use whole
multiples of 32K in specifying
 these options.
When CREATE TABLESPACE is used with ENGINE [=] NDB, a tablespace and
associated data file are created on each Cluster data node. You can
verify that the data files were created and obtain information about
them by querying the INFORMATION_SCHEMA.FILES table. (See the example
later in this section.)
https://dev.mysql.com/doc/refman/5.7/en/information-schema-files-table.
o ADD DATAFILE: Defines the name of a tablespace data file; this option
  is always 
required. The file_name, including any specified path, must
  be quoted with single or double quotation marks. File names (not
  counting the file extension) and directory names must be at least one
  byte in length. Zero length file names and directory names are not
  supported.
  Because there are considerable differences in how InnoDB and NDB
  treat data files, the two storage engines are covered separately in
  the discussion that follows.
  InnoDB data files An InnoDB tablespace supp
orts only a single data
  file, whose name must include a .ibd extension.
  For an InnoDB tablespace, the data file is created by default in the
  MySQL data directory (datadir). To place the data file in a location
  other than the default, include an absolute directory path or a path
  relative to the default location.
  When an InnoDB tablespace is created outside of the data directory,
  an isl file is created in the data directory. To avoid conflicts with
  implicitly created file-perk
-table tablespaces, creating an InnoDB
  general tablespace in a subdirectory under the data directory is not
  supported. When creating an InnoDB general tablespace outside of the
  data directory, the directory must exist prior to creating the
  tablespace.
  In MySQL 5.7, ALTER TABLESPACE is not supported by InnoDB.
  NDB data files An NDB tablespace supports multiple data files which
  can have any legal file names; more data files can be added to an NDB
  Cluster tablespace
 following its creation by using an ALTER
  TABLESPACE statement.
  An NDB tablespace data file is created by default in the data node
  file system directory---that is, the directory named ndb_nodeid_fs/TS
  under the data node's data directory (DataDir), where nodeid is the
  data node's NodeId. To place the data file in a location other than
  the default, include an absolute directory path or a path relative to
  the default location. If the directory specified does not exist, NDB
empts to create it; the system user account under which the data
  node process is running must have the appropriate permissions to do
  When determining the path used for a data file, NDB does not expand
  the ~ (tilde) character.
  When multiple data nodes are run on the same physical host, the
  following considerations apply:
  o You cannot specify an absolute path when creating a data file.
  o It is not possible to create tablespace data files outside the data
node file system directory, unless each data node has a separate
    data directory.
  o If each data node has its own data directory, data files can be
    created anywhere within this directory.
  o If each data node has its own data directory, it may also be
    possible to create a data file outside the node's data directory
    using a relative path, as long as this path resolves to a unique
    location on the host file system for each data node running on that
o FILE_BLOC
K_SIZE: This option---which is specific to InnoDB, and is
  ignored by NDB---defines the block size for the tablespace data file.
  Values can be specified in bytes or kilobytes. For example, an 8
  kilobyte file block size can be specified as 8192 or 8K. If you do
  not specify this option, FILE_BLOCK_SIZE defaults to the
  innodb_page_size value. FILE_BLOCK_SIZE is required when you intend
  to use the tablespace for storing compressed InnoDB tables
  (ROW_FORMAT=COMPRESSED). In this case,
 you must define the tablespace
  FILE_BLOCK_SIZE when creating the tablespace.
  If FILE_BLOCK_SIZE is equal the innodb_page_size value, the
  tablespace can contain only tables having an uncompressed row format
  (COMPACT, REDUNDANT, and DYNAMIC). Tables with a COMPRESSED row
  format have a different physical page size than uncompressed tables.
  Therefore, compressed tables cannot coexist in the same tablespace as
  uncompressed tables.
  For a general tablespace to contain compressed 0*
  FILE_BLOCK_SIZE must be specified, and the FILE_BLOCK_SIZE value must
  be a valid compressed page size in relation to the innodb_page_size
  value. Also, the physical page size of the compressed table
  (KEY_BLOCK_SIZE) must be equal to FILE_BLOCK_SIZE/1024. For example,
  if innodb_page_size=16K, and FILE_BLOCK_SIZE=8K, the KEY_BLOCK_SIZE
  of the table must be 8. For more information, see
  https://dev.mysql.com/doc/refman/5.7/en/general-tablespaces.html.
o USE LOGFILE GROUP: R
equired for NDB, this is the name of a log file
  group previously created using CREATE LOGFILE GROUP. Not supported
  for InnoDB, where it fails with an error.
o EXTENT_SIZE: This option is specific to NDB, and is not supported by
  InnoDB, where it fails with an error. EXTENT_SIZE sets the size, in
  bytes, of the extents used by any files belonging to the tablespace.
  The default value is 1M. The minimum size is 32K, and theoretical
  maximum is 2G, although the practical maximum size d
epends on a
  number of factors. In most cases, changing the extent size does not
  have any measurable effect on performance, and the default value is
  recommended for all but the most unusual situations.
  An extent is a unit of disk space allocation. One extent is filled
  with as much data as that extent can contain before another extent is
  used. In theory, up to 65,535 (64K) extents may used per data file;
  however, the recommended maximum is 32,768 (32K). The recommended
  maximum-I
 size for a single data file is 32G---that is, 32K extents x 1
  MB per extent. In addition, once an extent is allocated to a given
  partition, it cannot be used to store data from a different
  partition; an extent cannot store data from more than one partition.
  This means, for example that a tablespace having a single datafile
  whose INITIAL_SIZE (described in the following item) is 256 MB and
  whose EXTENT_SIZE is 128M has just two extents, and so can be used to
  store data from at 
most two different disk data table partitions.
  You can see how many extents remain free in a given data file by
  querying the INFORMATION_SCHEMA.FILES table, and so derive an
  estimate for how much space remains free in the file. For further
  discussion and examples, see
  https://dev.mysql.com/doc/refman/5.7/en/information-schema-files-tabl
o INITIAL_SIZE: This option is specific to NDB, and is not supported by
  InnoDB, where it fails with an error.
  The INITIAL_SIZE par
ameter sets the total size in bytes of the data
  file that was specific using ADD DATATFILE. Once this file has been
  created, its size cannot be changed; however, you can add more data
  files to the tablespace using ALTER TABLESPACE ... ADD DATAFILE.
  INITIAL_SIZE is optional; its default value is 134217728 (128 MB).
  On 32-bit systems, the maximum supported value for INITIAL_SIZE is
  4294967296 (4 GB).
o AUTOEXTEND_SIZE: Currently ignored by MySQL; reserved for possible
  future u
se. Has no effect in any release of MySQL 5.7 or MySQL NDB
  Cluster 7.5, regardless of the storage engine used.
o MAX_SIZE: Currently ignored by MySQL; reserved for possible future
  use. Has no effect in any release of MySQL 5.7 or MySQL NDB Cluster
  7.5, regardless of the storage engine used.
o NODEGROUP: Currently ignored by MySQL; reserved for possible future
  use. Has no effect in any release of MySQL 5.7 or MySQL NDB Cluster
  7.5, regardless of the storage engine used.
urrently ignored by MySQL; reserved for possible future use.
  Has no effect in any release of MySQL 5.7 or MySQL NDB Cluster 7.5,
  regardless of the storage engine used.
o COMMENT: Currently ignored by MySQL; reserved for possible future
  use. Has no effect in any release of MySQL 5.7 or MySQL NDB Cluster
  7.5, regardless of the storage engine used.
o ENGINE: Defines the storage engine which uses the tablespace, where
  engine_name is the name of the storage engine. Currently, only the
  InnoDB storage engine is supported by standard MySQL 5.7 releases.
  MySQL NDB Cluster 7.5 supports both NDB and InnoDB tablespaces. The
  value of the default_storage_engine system variable is used for
  ENGINE if the option is not specified.
o For the rules covering the naming of MySQL tablespaces, see
  https://dev.mysql.com/doc/refman/5.7/en/identifiers.html. In addition
  to these rules, the slash character (