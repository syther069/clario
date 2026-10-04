// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title ClarioTransactionRegistry
 * @notice Verifiable on-chain transaction commitment registry deployed on Monad Testnet (Chain ID 10143).
 * Preserves privacy: only cryptographic commitments (dataHash) and transaction identifiers
 * are stored on-chain. Sensitive financial details remain safely off-chain in Supabase.
 */
contract ClarioTransactionRegistry {
    // Custom errors for gas efficiency and clarity
    error InvalidTransactionId();
    error InvalidDataHash();
    error TransactionAlreadyExists(bytes32 transactionId);
    error TransactionNotFound(address user, bytes32 transactionId);

    error InvalidReceiptId();
    error InvalidReceiptHash();
    error InvalidTransactionCount();
    error ReceiptAlreadyExists(bytes32 receiptId);
    error ReceiptNotFound(address user, bytes32 receiptId);

    struct SavedTransaction {
        bytes32 transactionId;
        bytes32 dataHash;
        uint256 timestamp;
        address user;
    }

    struct Receipt {
        bytes32 receiptId;
        bytes32 receiptHash;
        uint256 transactionCount;
        uint256 timestamp;
        address owner;
    }

    // user => list of transactionIds
    mapping(address => bytes32[]) private _userTransactionIds;

    // user => transactionId => SavedTransaction
    mapping(address => mapping(bytes32 => SavedTransaction)) private _userTransactions;

    // user => list of receiptIds
    mapping(address => bytes32[]) private _userReceiptIds;

    // user => receiptId => Receipt
    mapping(address => mapping(bytes32 => Receipt)) private _userReceipts;

    // Event emitted on successful transaction commitment registration
    event TransactionSaved(
        address indexed user, bytes32 indexed transactionId, bytes32 dataHash, uint256 timestamp
    );

    // Event emitted on successful receipt bundle commitment registration
    event ReceiptSaved(
        address indexed owner,
        bytes32 indexed receiptId,
        bytes32 receiptHash,
        uint256 transactionCount,
        uint256 timestamp
    );

    /**
     * @notice Save a cryptographic transaction commitment for msg.sender.
     * @param transactionId Unique bytes32 identifier of the transaction.
     * @param dataHash Cryptographic commitment (keccak256) of canonical transaction data.
     */
    function saveTransaction(bytes32 transactionId, bytes32 dataHash) external {
        if (transactionId == bytes32(0)) revert InvalidTransactionId();
        if (dataHash == bytes32(0)) revert InvalidDataHash();

        SavedTransaction storage existing = _userTransactions[msg.sender][transactionId];
        if (existing.transactionId != bytes32(0)) {
            revert TransactionAlreadyExists(transactionId);
        }

        uint256 timestamp = block.timestamp;
        SavedTransaction memory record = SavedTransaction({
            transactionId: transactionId, dataHash: dataHash, timestamp: timestamp, user: msg.sender
        });

        _userTransactions[msg.sender][transactionId] = record;
        _userTransactionIds[msg.sender].push(transactionId);

        emit TransactionSaved(msg.sender, transactionId, dataHash, timestamp);
    }

    /**
     * @notice Save a multi-transaction receipt bundle commitment for msg.sender.
     * @param receiptId Unique bytes32 identifier of the receipt bundle.
     * @param receiptHash Cryptographic commitment (keccak256) of canonical receipt data.
     * @param transactionCount Number of Clario transactions bundled into this receipt.
     */
    function saveReceipt(bytes32 receiptId, bytes32 receiptHash, uint256 transactionCount)
        external
    {
        if (receiptId == bytes32(0)) revert InvalidReceiptId();
        if (receiptHash == bytes32(0)) revert InvalidReceiptHash();
        if (transactionCount == 0) revert InvalidTransactionCount();

        Receipt storage existing = _userReceipts[msg.sender][receiptId];
        if (existing.receiptId != bytes32(0)) {
            revert ReceiptAlreadyExists(receiptId);
        }

        uint256 timestamp = block.timestamp;
        Receipt memory record = Receipt({
            receiptId: receiptId,
            receiptHash: receiptHash,
            transactionCount: transactionCount,
            timestamp: timestamp,
            owner: msg.sender
        });

        _userReceipts[msg.sender][receiptId] = record;
        _userReceiptIds[msg.sender].push(receiptId);

        emit ReceiptSaved(msg.sender, receiptId, receiptHash, transactionCount, timestamp);
    }

    /**
     * @notice Retrieve all saved transaction commitments for a given user.
     * @param user The address of the user.
     * @return Array of SavedTransaction structs.
     */
    function getTransactions(address user) external view returns (SavedTransaction[] memory) {
        bytes32[] storage ids = _userTransactionIds[user];
        uint256 count = ids.length;
        SavedTransaction[] memory records = new SavedTransaction[](count);
        for (uint256 i = 0; i < count; i++) {
            records[i] = _userTransactions[user][ids[i]];
        }
        return records;
    }

    /**
     * @notice Retrieve paginated saved transaction commitments for a given user.
     * @param user The address of the user.
     * @param offset Starting index of the page.
     * @param limit Maximum number of records to return.
     * @return records Array of SavedTransaction structs.
     * @return total Total number of saved transactions for the user.
     */
    function getTransactionsPaginated(address user, uint256 offset, uint256 limit)
        external
        view
        returns (SavedTransaction[] memory records, uint256 total)
    {
        bytes32[] storage ids = _userTransactionIds[user];
        total = ids.length;
        if (offset >= total || limit == 0) {
            return (new SavedTransaction[](0), total);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 size = end - offset;
        records = new SavedTransaction[](size);
        for (uint256 i = 0; i < size; i++) {
            records[i] = _userTransactions[user][ids[offset + i]];
        }
    }

    /**
     * @notice Retrieve a specific saved transaction commitment for a user.
     * @param user The address of the user.
     * @param transactionId Unique bytes32 identifier of the transaction.
     * @return The SavedTransaction struct.
     */
    function getTransaction(address user, bytes32 transactionId)
        external
        view
        returns (SavedTransaction memory)
    {
        SavedTransaction storage record = _userTransactions[user][transactionId];
        if (record.transactionId == bytes32(0)) {
            revert TransactionNotFound(user, transactionId);
        }
        return record;
    }

    /**
     * @notice Get total count of saved transactions for a user.
     * @param user The address of the user.
     * @return Number of saved transactions.
     */
    function getTransactionCount(address user) external view returns (uint256) {
        return _userTransactionIds[user].length;
    }

    /**
     * @notice Retrieve all saved receipt bundles for a given user.
     * @param user The address of the user.
     * @return Array of Receipt structs.
     */
    function getReceipts(address user) external view returns (Receipt[] memory) {
        bytes32[] storage ids = _userReceiptIds[user];
        uint256 count = ids.length;
        Receipt[] memory records = new Receipt[](count);
        for (uint256 i = 0; i < count; i++) {
            records[i] = _userReceipts[user][ids[i]];
        }
        return records;
    }

    /**
     * @notice Retrieve paginated saved receipt bundles for a given user.
     * @param user The address of the user.
     * @param offset Starting index of the page.
     * @param limit Maximum number of records to return.
     * @return records Array of Receipt structs.
     * @return total Total number of saved receipt bundles for the user.
     */
    function getReceiptsPaginated(address user, uint256 offset, uint256 limit)
        external
        view
        returns (Receipt[] memory records, uint256 total)
    {
        bytes32[] storage ids = _userReceiptIds[user];
        total = ids.length;
        if (offset >= total || limit == 0) {
            return (new Receipt[](0), total);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 size = end - offset;
        records = new Receipt[](size);
        for (uint256 i = 0; i < size; i++) {
            records[i] = _userReceipts[user][ids[offset + i]];
        }
    }

    /**
     * @notice Retrieve a specific saved receipt bundle for a user.
     * @param user The address of the user.
     * @param receiptId Unique bytes32 identifier of the receipt bundle.
     * @return The Receipt struct.
     */
    function getReceipt(address user, bytes32 receiptId) external view returns (Receipt memory) {
        Receipt storage record = _userReceipts[user][receiptId];
        if (record.receiptId == bytes32(0)) {
            revert ReceiptNotFound(user, receiptId);
        }
        return record;
    }

    /**
     * @notice Get total count of saved receipt bundles for a user.
     * @param user The address of the user.
     * @return Number of saved receipt bundles.
     */
    function getReceiptCount(address user) external view returns (uint256) {
        return _userReceiptIds[user].length;
    }
}
